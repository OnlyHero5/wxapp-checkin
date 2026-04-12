use crate::api::auth_extractor::CurrentUser;
use crate::db::log_repo;
use crate::domain::{AttendanceActionType, format_activity_id};
use crate::error::AppError;
use serde_json::json;
use sqlx::Executor;

/// 普通用户签到/签退写 `suda_log` 时，只保留最小审计字段：
/// - 记录谁在什么活动上做了什么动作；
/// - 记录服务端时间和 record_id；
/// - 不在这里掺杂业务判定。
pub async fn insert_action_log<'e, E>(
  executor: E,
  current_user: &CurrentUser,
  legacy_activity_id: i64,
  action_type: AttendanceActionType,
  record_id: &str,
  server_time_ms: u64,
  client_ip: &str,
) -> Result<(), AppError>
where
  E: Executor<'e, Database = sqlx::MySql>,
{
  let path = if action_type == AttendanceActionType::Checkin {
    "/api/web/attendance/checkin"
  } else {
    "/api/web/attendance/checkout"
  };
  let content = json!({
    "activity_id": format_activity_id(legacy_activity_id),
    "legacy_activity_numeric_id": legacy_activity_id,
    "student_id": current_user.student_id,
    "user_id": current_user.user_id,
    "action_type": action_type.as_str(),
    "server_time_ms": server_time_ms,
    "record_id": record_id,
    "source": "wxapp-checkin-rust"
  });
  log_repo::insert_log(
    executor,
    &current_user.student_id,
    &current_user.name,
    path,
    &content,
    client_ip,
    "",
  )
  .await
}
