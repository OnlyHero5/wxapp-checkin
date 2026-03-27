use super::rules::ensure_activity_action_allowed;
use super::rules::ensure_activity_time_valid;
use super::rules::ensure_within_issue_window;
use super::rules::role_from_user;
use crate::api::activity::CodeSessionResponse;
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::activity_repo;
use crate::domain::{AttendanceActionType, WebRole, format_activity_id, parse_activity_id};
use crate::error::AppError;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

const ROTATE_SECONDS: u64 = 10;

type HmacSha256 = Hmac<Sha256>;

/// 动态码签发只允许 staff 触发。
/// 这里负责把活动合法性、时间窗口和轮换槽位统一编排成响应结果。
pub async fn issue_code_session(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  action_type: &AttendanceActionType,
) -> Result<CodeSessionResponse, AppError> {
  if role_from_user(current_user) != WebRole::Staff {
    return Err(AppError::business(
      "forbidden",
      "仅工作人员可获取动态码",
      None,
    ));
  }
  let legacy_activity_id = parse_activity_id(activity_id)?;
  let activity = activity_repo::find_activity_by_id(state.pool(), legacy_activity_id)
    .await?
    .ok_or_else(|| {
      AppError::business(
        "invalid_activity",
        "活动不存在或已下线",
        Some("invalid_activity"),
      )
    })?;
  ensure_activity_time_valid(&activity)?;
  ensure_activity_action_allowed(&activity, *action_type)?;
  ensure_within_issue_window(&activity, SystemTime::now())?;

  let server_time_ms = now_millis()?;
  let slot_window_ms = ROTATE_SECONDS * 1000;
  let slot = server_time_ms / slot_window_ms;
  let expires_at = (slot + 1) * slot_window_ms;
  let expires_in_ms = expires_at.saturating_sub(server_time_ms);
  let code = generate_code(
    &state.config().qr_signing_key,
    &format_activity_id(activity.legacy_activity_id),
    action_type.as_str(),
    slot,
  )?;

  Ok(CodeSessionResponse {
    status: "success".to_string(),
    message: "动态码获取成功".to_string(),
    activity_id: format_activity_id(activity.legacy_activity_id),
    action_type: *action_type,
    code,
    expires_at,
    expires_in_ms,
    server_time_ms,
    registered_count: activity.registered_count,
    checkin_count: activity.checkin_count,
    checkout_count: activity.checkout_count,
  })
}

/// 动态码校验继续接受当前 slot 命中和上一 slot 过期提示两种结果。
/// 这样前端和扫码端在轮换边界附近，仍能收到明确的“过期”而不是“无效”。
pub fn validate_dynamic_code(
  signing_key: &str,
  activity_id: &str,
  action_type: AttendanceActionType,
  code: &str,
  now_ms: u64,
) -> Result<u64, AppError> {
  let normalized_code = code.trim();
  if normalized_code.is_empty() {
    return Err(AppError::business(
      "invalid_code",
      "动态码错误，请重新确认",
      None,
    ));
  }

  let slot_window_ms = ROTATE_SECONDS * 1000;
  let current_slot = now_ms / slot_window_ms;
  let current_code = generate_code(
    signing_key,
    activity_id,
    action_type.as_str(),
    current_slot,
  )?;
  if current_code == normalized_code {
    return Ok(current_slot);
  }
  if current_slot > 0 {
    let previous_code = generate_code(
      signing_key,
      activity_id,
      action_type.as_str(),
      current_slot - 1,
    )?;
    if previous_code == normalized_code {
      return Err(AppError::business(
        "expired",
        "动态码已过期，请重新输入最新验证码",
        Some("expired"),
      ));
    }
  }

  Err(AppError::business(
    "invalid_code",
    "动态码错误，请重新确认",
    Some("invalid_code"),
  ))
}

fn generate_code(
  signing_key: &str,
  activity_id: &str,
  action_type: &str,
  slot: u64,
) -> Result<String, AppError> {
  let mut mac = HmacSha256::new_from_slice(signing_key.as_bytes())
    .map_err(|error| AppError::internal(format!("初始化动态码签名器失败：{error}")))?;
  mac.update(format!("web-code:v1|{activity_id}|{action_type}|{slot}").as_bytes());
  let digest = mac.finalize().into_bytes();
  let value = i32::from_be_bytes([digest[0], digest[1], digest[2], digest[3]]).wrapping_abs()
    as u32
    % 1_000_000;
  Ok(format!("{value:06}"))
}

fn now_millis() -> Result<u64, AppError> {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH"))
}

#[cfg(test)]
mod tests {
  use super::generate_code;
  use super::validate_dynamic_code;
  use crate::domain::AttendanceActionType;

  #[test]
  fn activity_code_should_be_stable_for_same_slot() {
    let code_a = generate_code("test-secret", "legacy_act_101", "checkin", 12).expect("code");
    let code_b = generate_code("test-secret", "legacy_act_101", "checkin", 12).expect("code");
    assert_eq!(code_a, code_b);
  }

  #[test]
  fn previous_slot_code_should_be_marked_expired() {
    let previous_code =
      generate_code("test-secret", "legacy_act_101", "checkin", 11).expect("code");
    let error = validate_dynamic_code(
      "test-secret",
      "legacy_act_101",
      AttendanceActionType::Checkin,
      &previous_code,
      12 * 10 * 1000,
    )
    .expect_err("should expire");
    assert_eq!(error.error_code(), Some("expired"));
  }
}
