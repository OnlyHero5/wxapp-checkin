use crate::app_state::AppState;
use crate::error::AppError;
use crate::service::auth_service;
use crate::api::client_ip::ClientIp;
use axum::Json;
use axum::Router;
use axum::extract::State;
use axum::routing::post;
use serde::{Deserialize, Serialize};

pub fn router() -> Router<AppState> {
  Router::new().route("/login", post(login))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct LoginRequest {
  pub student_id: String,
  pub password: String,
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
  pub user_profile: UserProfileResponse,
}

async fn login(
  State(state): State<AppState>,
  client_ip: ClientIp,
  Json(request): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
  let response =
    auth_service::login(&state, &request.student_id, &request.password, client_ip.as_str()).await?;
  Ok(Json(response))
}
