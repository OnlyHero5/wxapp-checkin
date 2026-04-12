use crate::db::activity_repo::ActivityRow;
use crate::db::activity_repo::UserActivityRow;
use crate::domain::AttendanceActionType;
use crate::error::AppError;
use chrono::TimeZone;
use std::time::{SystemTime, UNIX_EPOCH};

const LEGACY_CHINA_OFFSET_SECONDS: i32 = 8 * 60 * 60;

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

pub fn is_anomalous_attendance_state(row: &UserActivityRow) -> bool {
  row.check_in_flag == 0 && row.check_out_flag == 1
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
  _activity: &ActivityRow,
  _action_type: AttendanceActionType,
) -> Result<(), AppError> {
  // 当前正式口径以“开始前 30 分钟到结束后 30 分钟”的时间窗为准。
  // 因此活动进入 legacy completed 后，只要仍处于时间窗内，仍允许 staff 发码与用户完成收尾签退。
  Ok(())
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
  // suda_union 的 DATETIME 没有时区信息，但业务语义一直是北京时间本地时间。
  // 这里必须先按 +08:00 还原成“本地墙上时间对应的绝对时刻”，
  // 不能再直接 `and_utc()`，否则会把整个发码窗口整体推迟 8 小时。
  let offset =
    chrono::FixedOffset::east_opt(LEGACY_CHINA_OFFSET_SECONDS).expect("valid china offset");
  let timestamp = offset
    .from_local_datetime(&value)
    .single()
    .ok_or_else(|| AppError::internal("活动时间无法映射到北京时间"))?
    .timestamp_millis();
  u64::try_from(timestamp).map_err(|_| AppError::internal("活动时间非法"))
}

#[cfg(test)]
#[path = "rules_tests.rs"]
mod tests;
