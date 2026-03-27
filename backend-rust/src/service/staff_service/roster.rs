use super::access::require_activity;
use super::access::require_staff;
use super::audit::now_millis;
use crate::api::auth_extractor::CurrentUser;
use crate::api::staff::{ActivityRosterItem, ActivityRosterResponse};
use crate::app_state::AppState;
use crate::db::attendance_repo;
use crate::db::log_repo;
use crate::domain::format_activity_id;
use crate::error::AppError;
use crate::service::activity_service;

/// 名单读取只负责三件事：
/// - 校验 staff 权限；
/// - 加载活动与名单；
/// - 拼出前端需要的时间展示字段。
pub async fn get_roster(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
) -> Result<ActivityRosterResponse, AppError> {
  require_staff(current_user)?;
  let legacy_activity_id = crate::domain::parse_activity_id(activity_id)?;
  let activity = require_activity(state, legacy_activity_id).await?;
  let rows = attendance_repo::list_roster(state.pool(), legacy_activity_id).await?;
  let student_ids = rows
    .iter()
    .map(|row| row.student_id.clone())
    .collect::<Vec<_>>();
  let latest_checkin_times =
    log_repo::find_latest_action_times(state.pool(), &student_ids, "checkin", legacy_activity_id)
      .await?;
  let latest_checkout_times =
    log_repo::find_latest_action_times(state.pool(), &student_ids, "checkout", legacy_activity_id)
      .await?;

  let mut items = Vec::with_capacity(rows.len());
  for row in rows {
    let checked_in = row.check_in_flag == 1;
    let checked_out = row.check_out_flag == 1;
    let checkin_time = if checked_in || checked_out {
      latest_checkin_times
        .get(&row.student_id)
        .cloned()
        .map(activity_service::format_display_time)
        .unwrap_or_default()
    } else {
      String::new()
    };
    let checkout_time = if checked_out {
      latest_checkout_times
        .get(&row.student_id)
        .cloned()
        .map(activity_service::format_display_time)
        .unwrap_or_default()
    } else {
      String::new()
    };
    items.push(ActivityRosterItem {
      user_id: row.user_id,
      student_id: row.student_id,
      name: row.name,
      checked_in,
      checked_out,
      checkin_time,
      checkout_time,
    });
  }

  Ok(ActivityRosterResponse {
    status: "success".to_string(),
    message: "参会名单获取成功".to_string(),
    activity_id: format_activity_id(legacy_activity_id),
    activity_title: activity.activity_title,
    activity_type: crate::domain::activity_type_from_legacy(activity.legacy_type).to_string(),
    start_time: activity_service::format_display_time(activity.activity_stime),
    location: activity.location.unwrap_or_default(),
    description: activity.description.unwrap_or_default(),
    registered_count: activity.registered_count,
    checkin_count: activity.checkin_count,
    checkout_count: activity.checkout_count,
    items,
    server_time_ms: now_millis()?,
  })
}
