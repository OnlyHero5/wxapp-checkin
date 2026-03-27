use super::rules::format_display_time;
use super::rules::is_checked_in;
use super::rules::is_checked_out;
use super::rules::is_registered_apply_state;
use crate::api::activity::{ActivityListResponse, ActivitySummaryItem};
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::activity_repo::{self, ActivityRow, UserActivityRow};
use crate::domain::{
  WebRole, activity_type_from_legacy, format_activity_id, progress_status_from_legacy,
};
use crate::error::AppError;
use crate::service::shared_helpers::{now_millis, role_from_user};
use std::collections::HashMap;

const DEFAULT_PAGE: i64 = 1;
const DEFAULT_PAGE_SIZE: i64 = 50;
const MAX_PAGE_SIZE: i64 = 200;
const MAX_KEYWORD_LENGTH: usize = 100;
/// 活动列表服务只负责读路径编排：
/// - 规范分页与关键字参数；
/// - 调用对应角色的仓储查询；
/// - 批量补齐当前用户在当前页活动上的状态。
pub async fn list_activities(
  state: &AppState,
  current_user: &CurrentUser,
  page: Option<i64>,
  page_size: Option<i64>,
  keyword: Option<String>,
) -> Result<ActivityListResponse, AppError> {
  let normalized_page = normalize_page(page);
  let normalized_page_size = normalize_page_size(page_size)?;
  let normalized_keyword = normalize_keyword(keyword)?;
  let offset = (normalized_page - 1) * normalized_page_size;
  let limit = normalized_page_size + 1;
  let role = role_from_user(current_user);
  let mut rows = match role {
    WebRole::Staff => {
      activity_repo::list_staff_activities(
        state.pool(),
        limit,
        offset,
        normalized_keyword.as_deref(),
      )
      .await?
    }
    WebRole::Normal => {
      activity_repo::list_normal_activities(
        state.pool(),
        &current_user.student_id,
        limit,
        offset,
        normalized_keyword.as_deref(),
      )
      .await?
    }
  };
  let has_more = rows.len() as i64 > normalized_page_size;
  if has_more {
    rows.truncate(normalized_page_size as usize);
  }
  let user_activities = activity_repo::find_user_activities(
    state.pool(),
    &current_user.student_id,
    &collect_activity_ids(&rows),
  )
  .await?;
  let user_activity_map = build_user_activity_map(user_activities);
  let mut activities = Vec::with_capacity(rows.len());
  for row in rows {
    let user_activity = user_activity_map.get(&row.legacy_activity_id);
    activities.push(to_summary(&row, user_activity));
  }

  Ok(ActivityListResponse {
    status: "success".to_string(),
    message: "活动列表获取成功".to_string(),
    activities,
    page: normalized_page,
    page_size: normalized_page_size,
    has_more,
    server_time_ms: now_millis()?,
  })
}
fn to_summary(
  activity: &ActivityRow,
  user_activity: Option<&UserActivityRow>,
) -> ActivitySummaryItem {
  ActivitySummaryItem {
    activity_id: format_activity_id(activity.legacy_activity_id),
    activity_title: activity.activity_title.clone(),
    activity_type: activity_type_from_legacy(activity.legacy_type).to_string(),
    start_time: format_display_time(activity.activity_stime),
    location: activity.location.clone().unwrap_or_default(),
    description: activity.description.clone().unwrap_or_default(),
    progress_status: progress_status_from_legacy(activity.legacy_state).to_string(),
    support_checkout: true,
    support_checkin: true,
    registered_count: activity.registered_count,
    checkin_count: activity.checkin_count,
    checkout_count: activity.checkout_count,
    my_registered: user_activity
      .map(|row| is_registered_apply_state(row.state))
      .unwrap_or(false),
    my_checked_in: user_activity.map(is_checked_in).unwrap_or(false),
    my_checked_out: user_activity.map(is_checked_out).unwrap_or(false),
  }
}
pub(super) fn is_visible_for_normal(user_activity: Option<&UserActivityRow>) -> bool {
  user_activity
    .map(|row| is_registered_apply_state(row.state) || row.check_in_flag == 1)
    .unwrap_or(false)
}
fn normalize_page(value: Option<i64>) -> i64 {
  match value {
    Some(page) if page > 0 => page,
    _ => DEFAULT_PAGE,
  }
}
fn normalize_page_size(value: Option<i64>) -> Result<i64, AppError> {
  match value {
    Some(page_size) if page_size > MAX_PAGE_SIZE => Err(AppError::business(
      "invalid_param",
      format!("page_size 过大，最大允许 {MAX_PAGE_SIZE}"),
      None,
    )),
    Some(page_size) if page_size > 0 => Ok(page_size),
    _ => Ok(DEFAULT_PAGE_SIZE),
  }
}
fn normalize_keyword(value: Option<String>) -> Result<Option<String>, AppError> {
  let Some(raw_keyword) = value else {
    return Ok(None);
  };
  let normalized_keyword = raw_keyword.trim();
  if normalized_keyword.is_empty() {
    return Ok(None);
  }
  if normalized_keyword.chars().count() > MAX_KEYWORD_LENGTH {
    return Err(AppError::business(
      "invalid_param",
      format!("keyword 过长，最大允许 {MAX_KEYWORD_LENGTH} 个字符"),
      None,
    ));
  }
  Ok(Some(normalized_keyword.to_string()))
}
fn collect_activity_ids(rows: &[ActivityRow]) -> Vec<i64> {
  rows.iter().map(|row| row.legacy_activity_id).collect()
}
fn build_user_activity_map(
  rows: Vec<activity_repo::UserActivityWithActivityIdRow>,
) -> HashMap<i64, UserActivityRow> {
  let mut map = HashMap::with_capacity(rows.len());
  for row in rows {
    map.insert(
      row.legacy_activity_id,
      UserActivityRow {
        username: row.username,
        state: row.state,
        check_in_flag: row.check_in_flag,
        check_out_flag: row.check_out_flag,
      },
    );
  }
  map
}

#[cfg(test)]
#[path = "list_tests.rs"]
mod tests;
