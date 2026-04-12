use super::access::require_activity;
use super::access::require_staff;
use super::audit::StaffAuditActionKind;
use super::audit::StaffLogContext;
use super::audit::insert_batch_summary_log;
use super::audit::insert_staff_log;
use crate::api::auth_extractor::CurrentUser;
use crate::api::staff::BulkCheckoutInput;
use crate::api::staff::BulkCheckoutResponse;
use crate::app_state::AppState;
use crate::db::attendance_repo;
use crate::domain::format_activity_id;
use crate::error::AppError;
use crate::service::shared_helpers::{ensure_activity_has_no_anomalous_attendance_rows, now_millis};

/// 批量签退和名单修正共享同一审计上下文，但业务语义更单一：
/// - 必须显式确认；
/// - 对所有有效报名且尚未完成签退的记录收敛到“已签到且已签退”；
/// - 只有真正签退到成员时，才补一条批次汇总日志。
pub async fn bulk_checkout(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  input: BulkCheckoutInput,
  client_ip: &str,
) -> Result<BulkCheckoutResponse, AppError> {
  require_staff(current_user)?;
  let legacy_activity_id = crate::domain::parse_activity_id(activity_id)?;
  require_activity(state, legacy_activity_id).await?;
  ensure_activity_has_no_anomalous_attendance_rows(state, legacy_activity_id).await?;
  let BulkCheckoutInput { reason } = input;
  let batch_id = format!("batch_{}", now_millis()?);
  let server_time_ms = now_millis()?;
  let mut tx = state
    .pool()
    .begin()
    .await
    .map_err(|error| AppError::internal(format!("开启批量签退事务失败：{error}")))?;
  let log_context = StaffLogContext {
    client_ip,
    current_user,
    legacy_activity_id,
    action_kind: StaffAuditActionKind::BulkCheckout,
    batch_id: &batch_id,
    server_time_ms,
    reason: &reason,
  };
  let rows = attendance_repo::list_bulk_checkout_targets_for_update(&mut tx, legacy_activity_id).await?;
  let mut affected_count = 0_i64;
  for row in rows {
    attendance_repo::update_attendance_flags(&mut tx, row.record_id, 1, 1).await?;
    insert_staff_log(tx.as_mut(), &log_context, &row, 1, 1).await?;
    affected_count += 1;
  }
  if affected_count > 0 {
    insert_batch_summary_log(tx.as_mut(), &log_context, affected_count).await?;
  }
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
