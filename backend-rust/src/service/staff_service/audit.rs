use crate::api::auth_extractor::CurrentUser;
use crate::db::attendance_repo::ManagedAttendanceRow;
use crate::db::log_repo;
use crate::domain::format_activity_id;
use crate::error::AppError;
use serde_json::json;
use sqlx::Executor;
use std::time::{SystemTime, UNIX_EPOCH};

/// staff 的两类写操作都要落 `suda_log`，但审计路径不同。
/// 用枚举固定 path，可以避免 service 在多处手写 magic string。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum StaffAuditActionKind {
  AttendanceAdjustment,
  BulkCheckout,
}

impl StaffAuditActionKind {
  fn path(self) -> &'static str {
    match self {
      Self::AttendanceAdjustment => "/api/web/staff/attendance-adjustment",
      Self::BulkCheckout => "/api/web/staff/bulk-checkout",
    }
  }
}

/// 审计日志共享的上下文统一收敛在这里：
/// - 操作人；
/// - 活动；
/// - 批次；
/// - 服务端时间；
/// - 操作原因。
#[derive(Debug, Clone, Copy)]
pub(super) struct StaffLogContext<'a> {
  pub current_user: &'a CurrentUser,
  pub legacy_activity_id: i64,
  pub action_kind: StaffAuditActionKind,
  pub batch_id: &'a str,
  pub server_time_ms: u64,
  pub reason: &'a str,
}

/// 名单修正和批量签退都需要毫秒时间戳作为批次与日志字段。
/// 统一收口后，时间异常时的错误语义只需要维护一处。
pub(super) fn now_millis() -> Result<u64, AppError> {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH"))
}

pub(super) async fn insert_staff_log<'e, E>(
  executor: E,
  context: &StaffLogContext<'_>,
  row: &ManagedAttendanceRow,
  check_in: i64,
  check_out: i64,
) -> Result<(), AppError>
where
  E: Executor<'e, Database = sqlx::MySql>,
{
  let action_type = if check_in == 1 && check_out == 1 {
    "checkout"
  } else if check_in == 1 {
    "checkin"
  } else {
    "reset"
  };
  let content = json!({
    "activity_id": format_activity_id(context.legacy_activity_id),
    "legacy_activity_numeric_id": context.legacy_activity_id,
    "student_id": row.student_id,
    "user_id": row.user_id,
    "action_type": action_type,
    "server_time_ms": context.server_time_ms,
    "record_id": format!("{}_{}_{}", context.batch_id, row.user_id, context.server_time_ms),
    "operator_student_id": context.current_user.student_id,
    "reason": context.reason.trim(),
    "check_in": check_in,
    "check_out": check_out,
    "source": "wxapp-checkin-rust"
  });
  log_repo::insert_log(
    executor,
    &row.student_id,
    &row.name,
    context.action_kind.path(),
    &content,
    "",
    "",
  )
  .await
  .map_err(|error| AppError::internal(format!("写入 staff 审计日志失败：{error}")))
}

pub(super) async fn insert_batch_summary_log<'e, E>(
  executor: E,
  context: &StaffLogContext<'_>,
  affected_count: i64,
) -> Result<(), AppError>
where
  E: Executor<'e, Database = sqlx::MySql>,
{
  let content = json!({
    "activity_id": format_activity_id(context.legacy_activity_id),
    "legacy_activity_numeric_id": context.legacy_activity_id,
    "action_type": "bulk-checkout",
    "server_time_ms": context.server_time_ms,
    "record_id": context.batch_id,
    "operator_student_id": context.current_user.student_id,
    "reason": context.reason.trim(),
    "affected_count": affected_count,
    "source": "wxapp-checkin-rust"
  });
  log_repo::insert_log(
    executor,
    &context.current_user.student_id,
    &context.current_user.name,
    context.action_kind.path(),
    &content,
    "",
    "",
  )
  .await
  .map_err(|error| AppError::internal(format!("写入批量签退汇总日志失败：{error}")))
}
