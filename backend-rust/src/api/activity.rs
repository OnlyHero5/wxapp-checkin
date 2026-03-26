use crate::api::auth_extractor::require_current_user;
use crate::app_state::AppState;
use crate::error::AppError;
use crate::service::activity_service;
use crate::service::attendance_service;
use axum::Json;
use axum::Router;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use serde::{Deserialize, Serialize};

pub fn router() -> Router<AppState> {
  Router::new()
    .route("/", get(list_activities))
    .route("/{activity_id}", get(get_activity_detail))
    .route("/{activity_id}/code-session", get(get_code_session))
    .route("/{activity_id}/code-consume", post(consume_code))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityListQuery {
  pub page: Option<i64>,
  pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeSessionQuery {
  pub action_type: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeConsumeRequest {
  pub action_type: String,
  pub code: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivitySummaryItem {
  pub activity_id: String,
  pub activity_title: String,
  pub activity_type: String,
  pub start_time: String,
  pub location: String,
  pub description: String,
  pub progress_status: String,
  pub support_checkout: bool,
  pub support_checkin: bool,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
  pub my_registered: bool,
  pub my_checked_in: bool,
  pub my_checked_out: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityListResponse {
  pub status: String,
  pub message: String,
  pub activities: Vec<ActivitySummaryItem>,
  pub page: i64,
  pub page_size: i64,
  pub has_more: bool,
  pub server_time_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityDetailResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub activity_title: String,
  pub activity_type: String,
  pub start_time: String,
  pub location: String,
  pub description: String,
  pub progress_status: String,
  pub support_checkout: bool,
  pub support_checkin: bool,
  pub has_detail: bool,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
  pub my_registered: bool,
  pub my_checked_in: bool,
  pub my_checked_out: bool,
  pub my_checkin_time: String,
  pub my_checkout_time: String,
  pub can_checkin: bool,
  pub can_checkout: bool,
  pub server_time_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeSessionResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub action_type: String,
  pub code: String,
  pub expires_at: u64,
  pub expires_in_ms: u64,
  pub server_time_ms: u64,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeConsumeResponse {
  pub status: String,
  pub message: String,
  pub action_type: String,
  pub activity_id: String,
  pub activity_title: String,
  pub record_id: String,
  pub server_time_ms: u64,
}

async fn list_activities(
  State(state): State<AppState>,
  headers: HeaderMap,
  Query(query): Query<ActivityListQuery>,
) -> Result<Json<ActivityListResponse>, AppError> {
  let current_user = require_current_user(&headers, &state).await?;
  let response =
    activity_service::list_activities(&state, &current_user, query.page, query.page_size).await?;
  Ok(Json(response))
}

async fn get_activity_detail(
  State(state): State<AppState>,
  headers: HeaderMap,
  Path(activity_id): Path<String>,
) -> Result<Json<ActivityDetailResponse>, AppError> {
  let current_user = require_current_user(&headers, &state).await?;
  let response = activity_service::get_activity_detail(&state, &current_user, &activity_id).await?;
  Ok(Json(response))
}

async fn get_code_session(
  State(state): State<AppState>,
  headers: HeaderMap,
  Path(activity_id): Path<String>,
  Query(query): Query<CodeSessionQuery>,
) -> Result<Json<CodeSessionResponse>, AppError> {
  let current_user = require_current_user(&headers, &state).await?;
  let response =
    activity_service::issue_code_session(&state, &current_user, &activity_id, &query.action_type)
      .await?;
  Ok(Json(response))
}

async fn consume_code(
  State(state): State<AppState>,
  headers: HeaderMap,
  Path(activity_id): Path<String>,
  Json(request): Json<CodeConsumeRequest>,
) -> Result<Json<CodeConsumeResponse>, AppError> {
  let current_user = require_current_user(&headers, &state).await?;
  let response = attendance_service::consume_code(
    &state,
    &current_user,
    &activity_id,
    &request.action_type,
    &request.code,
  )
  .await?;
  Ok(Json(response))
}
