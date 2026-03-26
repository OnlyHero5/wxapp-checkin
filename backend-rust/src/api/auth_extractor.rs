use crate::app_state::AppState;
use crate::db::user_repo;
use crate::domain::role_from_legacy;
use crate::error::AppError;
use crate::service::auth_service;
use axum::http::HeaderMap;
use axum::http::header::AUTHORIZATION;
use std::time::SystemTime;

/// 当前用户快照只保留 handler 真正需要的字段。
/// 每次请求都从 token 反查一次数据库，确保角色和基础资料是最新值。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CurrentUser {
  pub user_id: i64,
  pub student_id: String,
  pub name: String,
  pub role: String,
  pub permissions: Vec<String>,
  pub department: String,
  pub club: String,
}

pub async fn require_current_user(
  headers: &HeaderMap,
  state: &AppState,
) -> Result<CurrentUser, AppError> {
  let session_token = extract_bearer_token(headers)?;
  let claims = state
    .session_token_signer()
    .verify(&session_token, SystemTime::now())?;
  let user = user_repo::find_user_by_student_id(state.pool(), &claims.student_id)
    .await?
    .ok_or_else(session_expired)?;

  if user.id != claims.uid {
    return Err(session_expired());
  }

  let current_user = auth_service::build_current_user(
    user.id,
    user.username,
    user.name,
    role_from_legacy(user.role),
    user.department.unwrap_or_default(),
  );

  Ok(current_user)
}

fn extract_bearer_token(headers: &HeaderMap) -> Result<String, AppError> {
  let raw = headers
    .get(AUTHORIZATION)
    .and_then(|value| value.to_str().ok())
    .unwrap_or("")
    .trim();
  let token = raw.strip_prefix("Bearer ").unwrap_or("").trim();
  if token.is_empty() {
    return Err(session_expired());
  }
  Ok(token.to_string())
}

fn session_expired() -> AppError {
  AppError::business("forbidden", "会话失效，请重新登录", Some("session_expired"))
}
