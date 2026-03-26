use crate::api::activity::CodeConsumeResponse;
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::activity_repo;
use crate::db::attendance_repo;
use crate::db::log_repo;
use crate::domain::{WebRole, format_activity_id};
use crate::error::AppError;
use crate::service::activity_service;
use serde_json::json;
use sqlx::Executor;
use std::time::{SystemTime, UNIX_EPOCH};

pub async fn consume_code(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  action_type: &str,
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
      action_type.trim(),
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
    action_type.trim(),
    server_time_ms
  );
  insert_action_log(
    tx.as_mut(),
    current_user,
    legacy_activity_id,
    action_type.trim(),
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
    action_type: action_type.trim().to_string(),
    activity_id: format_activity_id(legacy_activity_id),
    activity_title: activity.activity_title,
    record_id,
    server_time_ms,
  })
}

fn next_flags(
  attendance: &attendance_repo::AttendanceRecord,
  action_type: &str,
) -> Result<(i64, i64), AppError> {
  match action_type.trim() {
    "checkin" => {
      if attendance.check_in_flag == 0 {
        return Ok((1, 0));
      }
      if attendance.check_in_flag == 1 && attendance.check_out_flag == 0 {
        return Err(AppError::business(
          "duplicate",
          "你已签到，请勿重复提交",
          None,
        ));
      }
      Err(AppError::business(
        "forbidden",
        "当前状态不允许再次签到",
        None,
      ))
    }
    "checkout" => {
      if attendance.check_in_flag == 0 {
        return Err(AppError::business("forbidden", "请先完成签到再签退", None));
      }
      if attendance.check_in_flag == 1 && attendance.check_out_flag == 0 {
        return Ok((1, 1));
      }
      Err(AppError::business(
        "duplicate",
        "你已签退，请勿重复提交",
        None,
      ))
    }
    _ => Err(AppError::business(
      "invalid_param",
      "action_type 仅支持 checkin/checkout",
      None,
    )),
  }
}

async fn insert_action_log<'e, E>(
  executor: E,
  current_user: &CurrentUser,
  legacy_activity_id: i64,
  action_type: &str,
  record_id: &str,
  server_time_ms: u64,
) -> Result<(), AppError>
where
  E: Executor<'e, Database = sqlx::MySql>,
{
  let path = if action_type == "checkin" {
    "/api/web/attendance/checkin"
  } else {
    "/api/web/attendance/checkout"
  };
  let content = json!({
    "activity_id": format_activity_id(legacy_activity_id),
    "legacy_activity_numeric_id": legacy_activity_id,
    "student_id": current_user.student_id,
    "user_id": current_user.user_id,
    "action_type": action_type,
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
    "",
    "",
  )
  .await
}

fn role_from_user(current_user: &CurrentUser) -> WebRole {
  if current_user.role == "staff" {
    WebRole::Staff
  } else {
    WebRole::Normal
  }
}

fn now_millis() -> Result<u64, AppError> {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH"))
}

#[cfg(test)]
mod tests {
  use super::next_flags;
  use crate::db::attendance_repo::AttendanceRecord;

  #[test]
  fn checkin_should_move_none_to_checked_in() {
    let record = AttendanceRecord {
      id: 1,
      activity_id: 101,
      username: "2025000011".to_string(),
      state: 0,
      check_in_flag: 0,
      check_out_flag: 0,
    };

    let flags = next_flags(&record, "checkin").expect("flags");
    assert_eq!(flags, (1, 0));
  }

  #[test]
  fn checkout_should_reject_when_not_checked_in() {
    let record = AttendanceRecord {
      id: 1,
      activity_id: 101,
      username: "2025000011".to_string(),
      state: 0,
      check_in_flag: 0,
      check_out_flag: 0,
    };

    let error = next_flags(&record, "checkout").expect_err("should reject");
    assert_eq!(error.status(), "forbidden");
  }
}
