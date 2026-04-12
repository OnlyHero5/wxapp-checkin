use crate::app_state::AppState;
use crate::db::user_repo;
use crate::domain::role_from_legacy;
use crate::error::AppError;
use crate::service::auth_service;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use headers::Authorization;
use headers::HeaderMapExt;
use headers::authorization::Bearer;
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

/// 当前后端的绝大多数接口都要求先解析 session，再回表拿到最新用户快照。
/// 因此直接把 `CurrentUser` 做成 `axum` extractor：
/// - handler 不再手写 HeaderMap 解析；
/// - 权限入口统一到框架抽取流程；
/// - 后续若要接审计、中间件或共享拒绝响应，也能沿用同一边界。
impl FromRequestParts<AppState> for CurrentUser {
  type Rejection = AppError;

  async fn from_request_parts(
    parts: &mut Parts,
    state: &AppState,
  ) -> Result<Self, Self::Rejection> {
    let session_token = parts
      .headers
      .typed_get::<Authorization<Bearer>>()
      .map(|value| value.token().trim().to_string())
      .filter(|token| !token.is_empty())
      .ok_or_else(session_expired)?;
    load_current_user(state, &session_token).await
  }
}

/// 这里保留一个独立装载函数，而不是把数据库访问全部塞进 extractor impl：
/// - extractor 只负责接入框架；
/// - 用户快照装配仍可被后续测试、守卫或其它接入点复用；
/// - 认证失败的语义统一收敛到 `session_expired`。
async fn load_current_user(state: &AppState, session_token: &str) -> Result<CurrentUser, AppError> {
  let claims = state
    .session_token_signer()
    .verify(session_token, SystemTime::now())?;
  let user = user_repo::find_user_by_student_id(state.pool(), &claims.student_id)
    .await?
    .ok_or_else(session_expired)?;

  if user.id != claims.uid {
    return Err(session_expired());
  }
  auth_service::ensure_account_active(user.invalid)?;

  let current_user = auth_service::build_current_user(
    user.id,
    user.username,
    user.name,
    role_from_legacy(user.role),
    user.department.unwrap_or_default(),
  );

  Ok(current_user)
}

fn session_expired() -> AppError {
  AppError::business("forbidden", "会话失效，请重新登录", Some("session_expired"))
}
