use super::audit::insert_action_log;
use super::state_rules::next_flags;
use crate::api::activity::CodeConsumeResponse;
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::activity_repo;
use crate::db::attendance_repo;
use crate::domain::AttendanceActionType;
use crate::domain::WebRole;
use crate::domain::format_activity_id;
use crate::error::AppError;
use crate::service::activity_service;
use crate::service::shared_helpers::{now_millis, role_from_user};
use std::time::SystemTime;

/// 消费动态码是当前普通用户签到/签退的主流程。
/// 这个流程只负责串联：
/// - 活动与时间窗口校验；
/// - 动态码验签、限流和防重；
/// - 事务内更新报名记录并写日志。
pub async fn consume_code(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  action_type: AttendanceActionType,
  code: &str,
) -> Result<CodeConsumeResponse, AppError> {
  if role_from_user(current_user) != WebRole::Normal {
    return Err(AppError::business(
      "forbidden",
      "仅普通用户可签到/签退",
      None,
    ));
  }

  let legacy_activity_id = crate::domain::parse_activity_id(activity_id)?;
  let activity = activity_repo::find_activity_by_id(state.pool(), legacy_activity_id)
    .await?
    .ok_or_else(|| {
      AppError::business(
        "invalid_activity",
        "活动不存在或已下线",
        Some("invalid_activity"),
      )
    })?;
  activity_service::is_within_issue_window(&activity, SystemTime::now()).and_then(
    |within_window| {
      if within_window {
        Ok(true)
      } else {
        Err(AppError::business(
          "forbidden",
          "仅可在活动开始前30分钟到结束后30分钟内生成动态码",
          Some("outside_activity_time_window"),
        ))
      }
    },
  )?;

  let server_time_ms = now_millis()?;
  let slot = match activity_service::validate_dynamic_code(
    &state.config().qr_signing_key,
    &format_activity_id(legacy_activity_id),
    action_type,
    code,
    server_time_ms,
  ) {
    Ok(slot) => slot,
    Err(error) => {
      if matches!(error.error_code(), Some("invalid_code") | Some("expired")) {
        state
          .invalid_code_limiter()
          .record_invalid_attempt_or_throw(current_user.user_id, activity_id, server_time_ms)?;
      }
      return Err(error);
    }
  };
  state.replay_guard().acquire(
    &format!(
      "{}:{}:{}:{}",
      current_user.student_id,
      legacy_activity_id,
      action_type.as_str(),
      slot
    ),
    server_time_ms,
  )?;

  let mut tx = state
    .pool()
    .begin()
    .await
    .map_err(|error| AppError::internal(format!("开启签到事务失败：{error}")))?;
  let attendance = attendance_repo::find_attendance_for_update(
    &mut tx,
    legacy_activity_id,
    &current_user.student_id,
  )
  .await?
  .ok_or_else(|| AppError::business("forbidden", "你未报名该活动，无法签到/签退", None))?;
  if !activity_service::is_registered_apply_state(attendance.state) {
    return Err(AppError::business(
      "forbidden",
      "你未报名该活动，无法签到/签退",
      None,
    ));
  }

  let (check_in, check_out) = next_flags(&attendance, action_type)?;
  attendance_repo::update_attendance_flags(&mut tx, attendance.id, check_in, check_out).await?;
  let record_id = format!(
    "rec_{}_{}_{}_{}",
    current_user.student_id,
    legacy_activity_id,
    action_type.as_str(),
    server_time_ms
  );
  insert_action_log(
    tx.as_mut(),
    current_user,
    legacy_activity_id,
    action_type,
    &record_id,
    server_time_ms,
  )
  .await?;
  tx.commit()
    .await
    .map_err(|error| AppError::internal(format!("提交签到事务失败：{error}")))?;

  Ok(CodeConsumeResponse {
    status: "success".to_string(),
    message: "提交成功".to_string(),
    action_type,
    activity_id: format_activity_id(legacy_activity_id),
    activity_title: activity.activity_title,
    record_id,
    server_time_ms,
  })
}
