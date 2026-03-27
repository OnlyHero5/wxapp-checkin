use super::access::require_activity;
use super::access::require_staff;
use super::audit::StaffAuditActionKind;
use super::audit::StaffLogContext;
use super::audit::insert_batch_summary_log;
use super::audit::insert_staff_log;
use super::audit::now_millis;
use crate::api::auth_extractor::CurrentUser;
use crate::api::staff::{AttendanceAdjustmentResponse, BulkCheckoutResponse};
use crate::app_state::AppState;
use crate::db::attendance_repo;
use crate::db::attendance_repo::ManagedAttendanceRow;
use crate::domain::format_activity_id;
use crate::error::AppError;
/// 名单修正只允许 staff 在事务内批量调整已有报名记录。
/// 这里继续保留“只更新状态位，不改报名主体数据”的边界。
pub async fn adjust_attendance(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  user_ids: &[i64],
  checked_in: Option<bool>,
  checked_out: Option<bool>,
  reason: &str,
) -> Result<AttendanceAdjustmentResponse, AppError> {
  require_staff(current_user)?;
  validate_patch(checked_in, checked_out)?;
  let legacy_activity_id = crate::domain::parse_activity_id(activity_id)?;
  require_activity(state, legacy_activity_id).await?;
  let normalized_user_ids = normalize_user_ids(user_ids)?;
  let batch_id = format!("adj_{}", now_millis()?);
  let server_time_ms = now_millis()?;
  let mut tx = state
    .pool()
    .begin()
    .await
    .map_err(|error| AppError::internal(format!("开启名单修正事务失败：{error}")))?;
  let log_context = StaffLogContext {
    current_user,
    legacy_activity_id,
    action_kind: StaffAuditActionKind::AttendanceAdjustment,
    batch_id: &batch_id,
    server_time_ms,
    reason,
  };
  let rows =
    attendance_repo::list_by_user_ids_for_update(&mut tx, legacy_activity_id, &normalized_user_ids)
      .await?;
  if rows.len() != normalized_user_ids.len() {
    return Err(AppError::business(
      "invalid_param",
      "目标成员不存在、未报名或不属于当前活动",
      None,
    ));
  }
  let mut affected_count = 0_i64;
  for row in rows {
    let (check_in, check_out) = resolve_patch(&row, checked_in, checked_out)?;
    if check_in == row.check_in_flag && check_out == row.check_out_flag {
      continue;
    }
    attendance_repo::update_attendance_flags(&mut tx, row.record_id, check_in, check_out).await?;
    insert_staff_log(tx.as_mut(), &log_context, &row, check_in, check_out).await?;
    affected_count += 1;
  }
  tx.commit()
    .await
    .map_err(|error| AppError::internal(format!("提交名单修正事务失败：{error}")))?;

  Ok(AttendanceAdjustmentResponse {
    status: "success".to_string(),
    message: if affected_count > 0 {
      "名单状态修正完成".to_string()
    } else {
      "当前无需修正状态".to_string()
    },
    activity_id: format_activity_id(legacy_activity_id),
    affected_count,
    batch_id,
    server_time_ms,
  })
}
/// 批量签退和名单修正共享同一审计上下文，但业务语义更单一：
/// - 必须显式确认；
/// - 只处理“已签到未签退”的记录；
/// - 最后补一条批次汇总日志。
pub async fn bulk_checkout(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  confirm: bool,
  reason: &str,
) -> Result<BulkCheckoutResponse, AppError> {
  require_staff(current_user)?;
  if !confirm {
    return Err(AppError::business(
      "invalid_param",
      "批量签退必须显式确认",
      None,
    ));
  }
  let legacy_activity_id = crate::domain::parse_activity_id(activity_id)?;
  require_activity(state, legacy_activity_id).await?;
  let batch_id = format!("batch_{}", now_millis()?);
  let server_time_ms = now_millis()?;
  let mut tx = state
    .pool()
    .begin()
    .await
    .map_err(|error| AppError::internal(format!("开启批量签退事务失败：{error}")))?;
  let log_context = StaffLogContext {
    current_user,
    legacy_activity_id,
    action_kind: StaffAuditActionKind::BulkCheckout,
    batch_id: &batch_id,
    server_time_ms,
    reason,
  };
  let rows = attendance_repo::list_checked_in_for_update(&mut tx, legacy_activity_id).await?;
  let mut affected_count = 0_i64;
  for row in rows {
    attendance_repo::update_attendance_flags(&mut tx, row.record_id, 1, 1).await?;
    insert_staff_log(tx.as_mut(), &log_context, &row, 1, 1).await?;
    affected_count += 1;
  }
  insert_batch_summary_log(tx.as_mut(), &log_context, affected_count).await?;
  tx.commit()
    .await
    .map_err(|error| AppError::internal(format!("提交批量签退事务失败：{error}")))?;

  Ok(BulkCheckoutResponse {
    status: "success".to_string(),
    message: if affected_count > 0 {
      "批量签退完成".to_string()
    } else {
      "当前无需批量签退".to_string()
    },
    activity_id: format_activity_id(legacy_activity_id),
    affected_count,
    batch_id,
    server_time_ms,
  })
}
fn normalize_user_ids(user_ids: &[i64]) -> Result<Vec<i64>, AppError> {
  if user_ids.is_empty() {
    return Err(AppError::business(
      "invalid_param",
      "user_ids 不能为空",
      None,
    ));
  }
  let mut normalized = user_ids
    .iter()
    .copied()
    .filter(|user_id| *user_id > 0)
    .collect::<Vec<_>>();
  normalized.sort_unstable();
  normalized.dedup();
  Ok(normalized)
}
fn validate_patch(checked_in: Option<bool>, checked_out: Option<bool>) -> Result<(), AppError> {
  if checked_in.is_none() && checked_out.is_none() {
    return Err(AppError::business(
      "invalid_param",
      "patch 至少要包含一个状态位",
      None,
    ));
  }
  Ok(())
}
fn resolve_patch(
  row: &ManagedAttendanceRow,
  checked_in: Option<bool>,
  checked_out: Option<bool>,
) -> Result<(i64, i64), AppError> {
  if checked_in == Some(false) {
    return Ok((0, 0));
  }
  if checked_out == Some(true) {
    return Ok((1, 1));
  }
  if checked_in == Some(true) {
    return Ok((1, 0));
  }
  if checked_out == Some(false) {
    if row.check_in_flag == 0 && row.check_out_flag == 0 {
      return Ok((0, 0));
    }
    return Ok((1, 0));
  }
  Err(AppError::business("invalid_param", "patch 组合非法", None))
}
#[cfg(test)]
mod tests {
  use super::resolve_patch;
  use super::validate_patch;
  use crate::db::attendance_repo::ManagedAttendanceRow;

  #[test]
  fn patch_should_clear_both_flags_when_checked_in_false() {
    let row = ManagedAttendanceRow {
      record_id: 1,
      user_id: 11,
      student_id: "2025000011".to_string(),
      name: "测试用户".to_string(),
      state: 0,
      check_in_flag: 1,
      check_out_flag: 1,
    };
    assert_eq!(
      resolve_patch(&row, Some(false), Some(false)).expect("patch"),
      (0, 0)
    );
  }
  #[test]
  fn patch_should_require_at_least_one_flag() {
    assert!(validate_patch(None, None).is_err());
  }
}
