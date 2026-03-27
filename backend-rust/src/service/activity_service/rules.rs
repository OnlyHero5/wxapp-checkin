use crate::api::auth_extractor::CurrentUser;
use crate::db::activity_repo::ActivityRow;
use crate::db::activity_repo::UserActivityRow;
use crate::domain::AttendanceActionType;
use crate::domain::WebRole;
use crate::domain::progress_status_from_legacy;
use crate::error::AppError;
use std::time::{SystemTime, UNIX_EPOCH};

/// 报名状态、签到状态和时间窗口是多个活动接口共享的核心规则。
/// 统一放在这里，避免详情、列表和动态码接口各自复制判断分支。
pub fn is_registered_apply_state(value: i32) -> bool {
  value == 0 || value == 2
}

pub fn is_checked_in(row: &UserActivityRow) -> bool {
  row.check_in_flag == 1 && row.check_out_flag == 0
}

pub fn is_checked_out(row: &UserActivityRow) -> bool {
  row.check_in_flag == 1 && row.check_out_flag == 1
}

pub fn format_display_time(value: chrono::NaiveDateTime) -> String {
  value.format("%Y-%m-%d %H:%M").to_string()
}

/// 动态码的签发与消费都依赖同一个活动时间窗口。
/// 这里继续沿用“开始前 30 分钟到结束后 30 分钟”的既有契约。
pub fn is_within_issue_window(activity: &ActivityRow, now: SystemTime) -> Result<bool, AppError> {
  let now_ms = system_time_to_millis(now)?;
  let (start_ms, end_ms) = ensure_activity_time_valid(activity)?;
  Ok(now_ms >= start_ms.saturating_sub(30 * 60 * 1000) && now_ms <= end_ms + 30 * 60 * 1000)
}

pub(super) fn ensure_within_issue_window(
  activity: &ActivityRow,
  now: SystemTime,
) -> Result<(), AppError> {
  if !is_within_issue_window(activity, now)? {
    return Err(AppError::business(
      "forbidden",
      "仅可在活动开始前30分钟到结束后30分钟内生成动态码",
      Some("outside_activity_time_window"),
    ));
  }
  Ok(())
}

pub(super) fn ensure_activity_time_valid(activity: &ActivityRow) -> Result<(u64, u64), AppError> {
  let start_ms =
    naive_millis(activity.activity_stime).map_err(|_| invalid_activity_time_error())?;
  let end_ms = naive_millis(activity.activity_etime).map_err(|_| invalid_activity_time_error())?;
  if end_ms < start_ms {
    return Err(invalid_activity_time_error());
  }
  Ok((start_ms, end_ms))
}

pub(super) fn ensure_activity_action_allowed(
  activity: &ActivityRow,
  _action_type: AttendanceActionType,
) -> Result<(), AppError> {
  if progress_status_from_legacy(activity.legacy_state) == "completed" {
    return Err(AppError::business(
      "forbidden",
      "活动已结束，无法生成动态码",
      None,
    ));
  }
  Ok(())
}

pub(super) fn role_from_user(current_user: &CurrentUser) -> WebRole {
  if current_user.role == "staff" {
    WebRole::Staff
  } else {
    WebRole::Normal
  }
}

fn invalid_activity_time_error() -> AppError {
  AppError::business(
    "forbidden",
    "活动时间信息异常，请先修复活动时间数据",
    Some("activity_time_invalid"),
  )
}

fn system_time_to_millis(value: SystemTime) -> Result<u64, AppError> {
  value
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH"))
}

fn naive_millis(value: chrono::NaiveDateTime) -> Result<u64, AppError> {
  let timestamp = value.and_utc().timestamp_millis();
  u64::try_from(timestamp).map_err(|_| AppError::internal("活动时间非法"))
}

#[cfg(test)]
mod tests {
  use super::ensure_activity_time_valid;
  use super::format_display_time;
  use super::is_registered_apply_state;
  use crate::db::activity_repo::ActivityRow;

  fn sample_activity_row(start: chrono::NaiveDateTime, end: chrono::NaiveDateTime) -> ActivityRow {
    ActivityRow {
      legacy_activity_id: 101,
      activity_title: "测试活动".to_string(),
      description: Some("desc".to_string()),
      location: Some("loc".to_string()),
      activity_stime: start,
      activity_etime: end,
      legacy_type: 1,
      legacy_state: 1,
      registered_count: 0,
      checkin_count: 0,
      checkout_count: 0,
    }
  }

  #[test]
  fn registered_apply_state_should_match_legacy_rules() {
    assert!(is_registered_apply_state(0));
    assert!(is_registered_apply_state(2));
    assert!(!is_registered_apply_state(1));
  }

  #[test]
  fn display_time_should_keep_ui_format() {
    let naive = chrono::NaiveDate::from_ymd_opt(2026, 3, 25)
      .expect("date")
      .and_hms_opt(20, 4, 0)
      .expect("time");
    assert_eq!(format_display_time(naive), "2026-03-25 20:04");
  }

  #[test]
  fn invalid_activity_time_should_use_contract_error_code() {
    let start = chrono::NaiveDate::from_ymd_opt(2026, 3, 25)
      .expect("date")
      .and_hms_opt(20, 4, 0)
      .expect("time");
    let end = chrono::NaiveDate::from_ymd_opt(2026, 3, 25)
      .expect("date")
      .and_hms_opt(19, 59, 0)
      .expect("time");
    let activity = sample_activity_row(start, end);

    let error = ensure_activity_time_valid(&activity).expect_err("should reject invalid time");
    assert_eq!(error.status(), "forbidden");
    assert_eq!(error.error_code(), Some("activity_time_invalid"));
  }
}
