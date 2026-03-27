use super::access::require_activity;
use super::access::require_staff;
use super::audit::StaffAuditActionKind;
use super::audit::StaffLogContext;
use super::audit::insert_batch_summary_log;
use super::audit::insert_staff_log;
use super::audit::now_millis;
use crate::api::staff::BulkCheckoutInput;
use crate::api::auth_extractor::CurrentUser;
use crate::api::staff::BulkCheckoutResponse;
use crate::app_state::AppState;
use crate::db::attendance_repo;
use crate::domain::format_activity_id;
use crate::error::AppError;

/// 批量签退和名单修正共享同一审计上下文，但业务语义更单一：
/// - 必须显式确认；
/// - 只处理“已签到未签退”的记录；
/// - 最后补一条批次汇总日志。
pub async fn bulk_checkout(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  input: BulkCheckoutInput,
) -> Result<BulkCheckoutResponse, AppError> {
  require_staff(current_user)?;
  let legacy_activity_id = crate::domain::parse_activity_id(activity_id)?;
  require_activity(state, legacy_activity_id).await?;
  let BulkCheckoutInput { reason } = input;
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
    reason: &reason,
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
