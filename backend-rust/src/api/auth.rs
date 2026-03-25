use crate::api::auth_extractor::require_current_user;
use crate::app_state::AppState;
use crate::error::AppError;
use crate::service::auth_service;
use axum::Json;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::post;
use axum::Router;
use serde::{Deserialize, Serialize};

pub fn router() -> Router<AppState> {
  Router::new()
    .route("/login", post(login))
    .route("/change-password", post(change_password))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct LoginRequest {
  pub student_id: String,
  pub password: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ChangePasswordRequest {
  pub old_password: String,
  pub new_password: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct UserProfileResponse {
  pub student_id: String,
  pub name: String,
  pub department: String,
  pub club: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct LoginResponse {
  pub status: String,
  pub message: String,
  pub session_token: String,
  pub session_expires_at: u64,
  pub role: String,
  pub permissions: Vec<String>,
  pub must_change_password: bool,
  pub user_profile: UserProfileResponse,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ChangePasswordResponse {
  pub status: String,
  pub message: String,
  pub must_change_password: bool,
}

async fn login(
  State(state): State<AppState>,
  Json(request): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
  let response = auth_service::login(&state, &request.student_id, &request.password).await?;
  Ok(Json(response))
}

async fn change_password(
  State(state): State<AppState>,
  headers: HeaderMap,
  Json(request): Json<ChangePasswordRequest>,
) -> Result<Json<ChangePasswordResponse>, AppError> {
  let current_user = require_current_user(&headers, &state, true).await?;
  let response = auth_service::change_password(
    &state,
    &current_user,
    &request.old_password,
    &request.new_password,
  )
  .await?;
  Ok(Json(response))
}
