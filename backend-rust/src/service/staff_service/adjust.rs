use super::access::require_activity;
use super::access::require_staff;
use super::audit::StaffAuditActionKind;
use super::audit::StaffLogContext;
use super::audit::insert_batch_summary_log;
use super::audit::insert_staff_log;
use crate::api::auth_extractor::CurrentUser;
use crate::api::staff::AttendanceAdjustmentInput;
use crate::api::staff::AttendanceAdjustmentResponse;
use crate::app_state::AppState;
use crate::db::attendance_repo;
use crate::domain::format_activity_id;
use crate::error::AppError;
use crate::service::shared_helpers::now_millis;

/// 名单修正只允许 staff 在事务内批量调整已有报名记录。
/// 这里继续保留“只更新状态位，不改报名主体数据”的边界。
pub async fn adjust_attendance(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  input: AttendanceAdjustmentInput,
  client_ip: &str,
) -> Result<AttendanceAdjustmentResponse, AppError> {
  require_staff(current_user)?;
  let legacy_activity_id = crate::domain::parse_activity_id(activity_id)?;
  require_activity(state, legacy_activity_id).await?;
  let AttendanceAdjustmentInput {
    user_ids,
    patch,
    reason,
  } = input;
  let batch_id = format!("adj_{}", now_millis()?);
  let server_time_ms = now_millis()?;
  let mut tx = state
    .pool()
    .begin()
    .await
    .map_err(|error| AppError::internal(format!("开启名单修正事务失败：{error}")))?;
  let log_context = StaffLogContext {
    client_ip,
    current_user,
    legacy_activity_id,
    action_kind: StaffAuditActionKind::AttendanceAdjustment,
    batch_id: &batch_id,
    server_time_ms,
    reason: &reason,
  };
  let rows =
    attendance_repo::list_by_user_ids_for_update(&mut tx, legacy_activity_id, &user_ids).await?;
  if rows.len() != user_ids.len() {
    return Err(AppError::business(
      "invalid_param",
      "目标成员不存在、未报名或不属于当前活动",
      None,
    ));
  }
  let mut affected_count = 0_i64;
  for row in rows {
    let (check_in, check_out) = patch.apply(row.check_in_flag, row.check_out_flag);
    if check_in == row.check_in_flag && check_out == row.check_out_flag {
      continue;
    }
    attendance_repo::update_attendance_flags(&mut tx, row.record_id, check_in, check_out).await?;
    insert_staff_log(tx.as_mut(), &log_context, &row, check_in, check_out).await?;
    affected_count += 1;
  }
  if affected_count > 0 {
    insert_batch_summary_log(tx.as_mut(), &log_context, affected_count).await?;
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
