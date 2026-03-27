use super::audit::insert_action_log;
use super::state_rules::next_flags;
use crate::api::activity::CodeConsumeResponse;
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::activity_repo;
use crate::db::activity_repo::ActivityRow;
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
  ensure_normal_user_can_consume(current_user)?;
  let (legacy_activity_id, activity) = load_activity_or_throw(state, activity_id).await?;

  let server_time_ms = now_millis()?;
  let slot = validate_code_slot(
    state,
    current_user,
    activity_id,
    legacy_activity_id,
    action_type,
    code,
    server_time_ms,
  )?;
  state.replay_guard().acquire(
    &build_replay_guard_key(current_user, legacy_activity_id, action_type, slot),
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
  let record_id = build_record_id(
    &current_user.student_id,
    legacy_activity_id,
    action_type,
    server_time_ms,
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

/// 签到/签退链路当前只对普通用户开放。
/// 角色守卫单独抽出来后，主流程可以只保留真正的业务编排。
fn ensure_normal_user_can_consume(current_user: &CurrentUser) -> Result<(), AppError> {
  if role_from_user(current_user) == WebRole::Normal {
    return Ok(());
  }

  Err(AppError::business(
    "forbidden",
    "仅普通用户可签到/签退",
    None,
  ))
}

/// 活动装载与基础时间窗口校验总是成对出现。
/// 这里统一收口后，主流程就不用再同时维护 parse / query / 时间错误映射。
async fn load_activity_or_throw(
  state: &AppState,
  activity_id: &str,
) -> Result<(i64, ActivityRow), AppError> {
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

  Ok((legacy_activity_id, activity))
}

/// 动态码验签失败时，只有“非法码 / 过期码”才计入错误次数。
/// 这一层把限流副作用一起收口，避免主流程继续夹着一段 `match` 分支。
fn validate_code_slot(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  legacy_activity_id: i64,
  action_type: AttendanceActionType,
  code: &str,
  server_time_ms: u64,
) -> Result<u64, AppError> {
  match activity_service::validate_dynamic_code(
    &state.config().qr_signing_key,
    &format_activity_id(legacy_activity_id),
    action_type,
    code,
    server_time_ms,
  ) {
    Ok(slot) => Ok(slot),
    Err(error) => {
      if matches!(error.error_code(), Some("invalid_code") | Some("expired")) {
        state
          .invalid_code_limiter()
          .record_invalid_attempt_or_throw(current_user.user_id, activity_id, server_time_ms)?;
      }
      Err(error)
    }
  }
}

/// replay key 只编码“同一用户、同一活动、同一动作、同一时间槽”。
/// 键格式单独收口后，后续若要调整幂等粒度，不必再回主流程改字符串拼接。
fn build_replay_guard_key(
  current_user: &CurrentUser,
  legacy_activity_id: i64,
  action_type: AttendanceActionType,
  slot: u64,
) -> String {
  format!(
    "{}:{}:{}:{}",
    current_user.student_id,
    legacy_activity_id,
    action_type.as_str(),
    slot
  )
}

/// 流水号仍然保持旧的可读格式，便于日志排查和与旧系统对账。
/// 这里只把拼接逻辑独立出来，不改变对外合同。
fn build_record_id(
  student_id: &str,
  legacy_activity_id: i64,
  action_type: AttendanceActionType,
  server_time_ms: u64,
) -> String {
  format!(
    "rec_{}_{}_{}_{}",
    student_id,
    legacy_activity_id,
    action_type.as_str(),
    server_time_ms
  )
}
