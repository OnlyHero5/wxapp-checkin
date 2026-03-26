use crate::api::auth::{ChangePasswordResponse, LoginResponse, UserProfileResponse};
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::user_repo;
use crate::domain::{WebRole, must_change_password, permissions_for_role, role_from_legacy};
use crate::error::AppError;
use bcrypt::DEFAULT_COST;
use std::time::{SystemTime, UNIX_EPOCH};

const MIN_PASSWORD_LENGTH: usize = 6;
const MAX_PASSWORD_LENGTH: usize = 64;

/// 认证服务故意保持“薄业务层”：
/// - 只组合仓储、密码规则和 token；
/// - 不在这里掺 HTTP 细节；
/// - 这样后续 CLI/集成测试也能复用同一套核心逻辑。
pub async fn login(
  state: &AppState,
  student_id: &str,
  password: &str,
) -> Result<LoginResponse, AppError> {
  let normalized_student_id = normalize(student_id);
  let normalized_password = normalize(password);
  if normalized_student_id.is_empty() || normalized_password.is_empty() {
    return Err(AppError::business("invalid_param", "student_id 和 password 不能为空", None));
  }

  let user = user_repo::find_user_by_student_id(state.pool(), &normalized_student_id)
    .await?
    .ok_or_else(|| AppError::business("forbidden", "学号不存在，请确认后重试", Some("identity_not_found")))?;

  verify_password(user.password.as_deref(), &normalized_password)?;
  let role = role_from_legacy(user.role);
  let permissions = permissions_for_role(role)
    .into_iter()
    .map(str::to_string)
    .collect::<Vec<_>>();
  let must_change = must_change_password(user.password.as_deref());
  let issued_at = SystemTime::now();
  let session_token = state
    .session_token_signer()
    .issue(user.id, &user.username, role.as_str(), issued_at)?;
  let issued_at_ms = issued_at
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间异常，无法计算会话过期时间"))?;
  let session_expires_at = issued_at_ms + state.config().session_ttl_seconds * 1000;

  Ok(LoginResponse {
    status: "success".to_string(),
    message: if must_change {
      "登录成功，请修改密码".to_string()
    } else {
      "登录成功".to_string()
    },
    session_token,
    session_expires_at,
    role: role.as_str().to_string(),
    permissions,
    must_change_password: must_change,
    user_profile: UserProfileResponse {
      student_id: user.username,
      name: user.name,
      department: user.department.unwrap_or_default(),
      club: String::new(),
    },
  })
}

pub async fn change_password(
  state: &AppState,
  current_user: &CurrentUser,
  old_password: &str,
  new_password: &str,
) -> Result<ChangePasswordResponse, AppError> {
  let normalized_old_password = normalize(old_password);
  let normalized_new_password = normalize(new_password);
  validate_new_password(&normalized_new_password)?;

  let user = user_repo::find_user_by_student_id(state.pool(), &current_user.student_id)
    .await?
    .ok_or_else(session_expired)?;

  verify_password(user.password.as_deref(), &normalized_old_password)?;
  let new_password_hash = bcrypt::hash(&normalized_new_password, DEFAULT_COST)
    .map_err(|error| AppError::internal(format!("生成密码 hash 失败：{error}")))?;
  user_repo::update_password(state.pool(), &current_user.student_id, &new_password_hash).await?;

  Ok(ChangePasswordResponse {
    status: "success".to_string(),
    message: "密码修改成功".to_string(),
    must_change_password: false,
  })
}

pub fn build_current_user(
  user_id: i64,
  student_id: String,
  name: String,
  role: WebRole,
  department: String,
  raw_password_hash: Option<&str>,
) -> CurrentUser {
  CurrentUser {
    user_id,
    student_id,
    name,
    role: role.as_str().to_string(),
    permissions: permissions_for_role(role)
      .into_iter()
      .map(str::to_string)
      .collect(),
    must_change_password: must_change_password(raw_password_hash),
    department,
    club: String::new(),
  }
}

fn verify_password(password_hash: Option<&str>, password: &str) -> Result<(), AppError> {
  let normalized_hash = password_hash.map(str::trim).unwrap_or("");
  if normalized_hash.is_empty() {
    return Err(AppError::business("forbidden", "密码错误", Some("invalid_password")));
  }
  let matches = bcrypt::verify(password, normalized_hash)
    .map_err(|_| AppError::business("forbidden", "密码错误", Some("invalid_password")))?;
  if !matches {
    return Err(AppError::business("forbidden", "密码错误", Some("invalid_password")));
  }
  Ok(())
}

fn validate_new_password(new_password: &str) -> Result<(), AppError> {
  if new_password.is_empty() {
    return Err(AppError::business("invalid_param", "新密码不能为空", None));
  }
  if new_password.len() < MIN_PASSWORD_LENGTH {
    return Err(AppError::business(
      "invalid_param",
      format!("新密码过短，请设置至少 {MIN_PASSWORD_LENGTH} 位"),
      Some("password_too_short"),
    ));
  }
  if new_password.len() > MAX_PASSWORD_LENGTH {
    return Err(AppError::business(
      "invalid_param",
      format!("新密码过长，请设置不超过 {MAX_PASSWORD_LENGTH} 位"),
      Some("password_too_long"),
    ));
  }
  Ok(())
}

fn normalize(value: &str) -> String {
  value.trim().to_string()
}

fn session_expired() -> AppError {
  AppError::business("forbidden", "会话失效，请重新登录", Some("session_expired"))
}

#[cfg(test)]
mod tests {
  use super::{build_current_user, validate_new_password};
  use crate::domain::WebRole;

  #[test]
  fn current_user_should_inherit_staff_permissions() {
    let current_user = build_current_user(
      7,
      "2025000007".to_string(),
      "刘洋".to_string(),
      WebRole::Staff,
      "学生会".to_string(),
      None,
    );

    assert_eq!(current_user.role, "staff");
    assert!(current_user.permissions.contains(&"activity:manage".to_string()));
  }

  #[test]
  fn new_password_should_enforce_length_range() {
    assert!(validate_new_password("12345").is_err());
    assert!(validate_new_password("123456").is_ok());
  }
}
