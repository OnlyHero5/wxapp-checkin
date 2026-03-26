use crate::api::auth::{LoginResponse, UserProfileResponse};
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::user_repo;
use crate::domain::{WebRole, permissions_for_role, role_from_legacy};
use crate::error::AppError;
use std::time::{SystemTime, UNIX_EPOCH};

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
    message: "登录成功".to_string(),
    session_token,
    session_expires_at,
    role: role.as_str().to_string(),
    permissions,
    user_profile: UserProfileResponse {
      student_id: user.username,
      name: user.name,
      department: user.department.unwrap_or_default(),
      club: String::new(),
    },
  })
}

pub fn build_current_user(
  user_id: i64,
  student_id: String,
  name: String,
  role: WebRole,
  department: String,
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

fn normalize(value: &str) -> String {
  value.trim().to_string()
}

#[cfg(test)]
mod tests {
  use super::build_current_user;
  use crate::domain::WebRole;

  #[test]
  fn current_user_should_inherit_staff_permissions() {
    let current_user = build_current_user(
      7,
      "2025000007".to_string(),
      "刘洋".to_string(),
      WebRole::Staff,
      "学生会".to_string(),
    );

    assert_eq!(current_user.role, "staff");
    assert!(current_user.permissions.contains(&"activity:manage".to_string()));
  }
}
