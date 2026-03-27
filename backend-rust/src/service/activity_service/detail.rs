use super::list::is_visible_for_normal;
use super::rules::format_display_time;
use super::rules::is_checked_in;
use super::rules::is_checked_out;
use super::rules::is_registered_apply_state;
use super::rules::is_within_issue_window;
use super::rules::role_from_user;
use crate::api::activity::ActivityDetailResponse;
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::activity_repo;
use crate::db::log_repo;
use crate::domain::{
  WebRole, activity_type_from_legacy, format_activity_id, parse_activity_id,
  progress_status_from_legacy,
};
use crate::error::AppError;
use std::time::{SystemTime, UNIX_EPOCH};

/// 活动详情服务负责把活动主信息、用户状态和展示字段拼成单个响应。
/// 详情页和列表页共用同一套规则函数，但这里会额外补查个人签到/签退时间。
pub async fn get_activity_detail(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
) -> Result<ActivityDetailResponse, AppError> {
  let legacy_activity_id = parse_activity_id(activity_id)?;
  let activity = activity_repo::find_activity_by_id(state.pool(), legacy_activity_id)
    .await?
    .ok_or_else(|| {
      AppError::business(
        "invalid_activity",
        "活动不存在或已下线",
        Some("invalid_activity"),
      )
    })?;
  let user_activity =
    activity_repo::find_user_activity(state.pool(), legacy_activity_id, &current_user.student_id)
      .await?;
  if role_from_user(current_user) == WebRole::Normal
    && !is_visible_for_normal(user_activity.as_ref())
  {
    return Err(AppError::business(
      "forbidden",
      "你无权查看该活动详情",
      None,
    ));
  }

  let within_window = is_within_issue_window(&activity, SystemTime::now())?;
  let my_registered = user_activity
    .as_ref()
    .map(|row| is_registered_apply_state(row.state))
    .unwrap_or(false);
  let my_checked_in = user_activity.as_ref().map(is_checked_in).unwrap_or(false);
  let my_checked_out = user_activity.as_ref().map(is_checked_out).unwrap_or(false);
  let activity_not_completed = progress_status_from_legacy(activity.legacy_state) != "completed";
  let can_checkin =
    within_window && activity_not_completed && my_registered && !my_checked_in && !my_checked_out;
  let can_checkout = within_window && activity_not_completed && my_checked_in && !my_checked_out;
  let my_checkin_time = if my_checked_in || my_checked_out {
    log_repo::find_latest_action_time(
      state.pool(),
      &current_user.student_id,
      "checkin",
      legacy_activity_id,
    )
    .await?
    .map(format_display_time)
    .unwrap_or_default()
  } else {
    String::new()
  };
  let my_checkout_time = if my_checked_out {
    log_repo::find_latest_action_time(
      state.pool(),
      &current_user.student_id,
      "checkout",
      legacy_activity_id,
    )
    .await?
    .map(format_display_time)
    .unwrap_or_default()
  } else {
    String::new()
  };

  Ok(ActivityDetailResponse {
    status: "success".to_string(),
    message: "活动详情获取成功".to_string(),
    activity_id: format_activity_id(activity.legacy_activity_id),
    activity_title: activity.activity_title,
    activity_type: activity_type_from_legacy(activity.legacy_type).to_string(),
    start_time: format_display_time(activity.activity_stime),
    location: activity.location.unwrap_or_default(),
    description: activity.description.unwrap_or_default(),
    progress_status: progress_status_from_legacy(activity.legacy_state).to_string(),
    support_checkout: true,
    support_checkin: true,
    has_detail: true,
    registered_count: activity.registered_count,
    checkin_count: activity.checkin_count,
    checkout_count: activity.checkout_count,
    my_registered,
    my_checked_in,
    my_checked_out,
    my_checkin_time,
    my_checkout_time,
    can_checkin,
    can_checkout,
    server_time_ms: now_millis()?,
  })
}

fn now_millis() -> Result<u64, AppError> {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH"))
}
