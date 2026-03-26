use crate::api::auth_extractor::require_current_user;
use crate::app_state::AppState;
use crate::error::AppError;
use crate::service::staff_service;
use axum::Json;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize, Serialize};

pub fn router() -> Router<AppState> {
  Router::new()
    .route("/activities/{activity_id}/roster", get(get_roster))
    .route("/activities/{activity_id}/attendance-adjustments", post(adjust_attendance))
    .route("/activities/{activity_id}/bulk-checkout", post(bulk_checkout))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AttendanceAdjustmentRequest {
  pub user_ids: Vec<i64>,
  pub patch: AttendanceAdjustmentPatch,
  pub reason: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AttendanceAdjustmentPatch {
  pub checked_in: Option<bool>,
  pub checked_out: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BulkCheckoutRequest {
  pub confirm: bool,
  pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityRosterItem {
  pub user_id: i64,
  pub student_id: String,
  pub name: String,
  pub checked_in: bool,
  pub checked_out: bool,
  pub checkin_time: String,
  pub checkout_time: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityRosterResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub activity_title: String,
  pub activity_type: String,
  pub start_time: String,
  pub location: String,
  pub description: String,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
  pub items: Vec<ActivityRosterItem>,
  pub server_time_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AttendanceAdjustmentResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub affected_count: i64,
  pub batch_id: String,
  pub server_time_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct BulkCheckoutResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub affected_count: i64,
  pub batch_id: String,
  pub server_time_ms: u64,
}

async fn get_roster(
  State(state): State<AppState>,
  headers: HeaderMap,
  Path(activity_id): Path<String>,
) -> Result<Json<ActivityRosterResponse>, AppError> {
  let current_user = require_current_user(&headers, &state).await?;
  let response = staff_service::get_roster(&state, &current_user, &activity_id).await?;
  Ok(Json(response))
}

async fn adjust_attendance(
  State(state): State<AppState>,
  headers: HeaderMap,
  Path(activity_id): Path<String>,
  Json(request): Json<AttendanceAdjustmentRequest>,
) -> Result<Json<AttendanceAdjustmentResponse>, AppError> {
  let current_user = require_current_user(&headers, &state).await?;
  let response = staff_service::adjust_attendance(
    &state,
    &current_user,
    &activity_id,
    &request.user_ids,
    request.patch.checked_in,
    request.patch.checked_out,
    &request.reason,
  )
  .await?;
  Ok(Json(response))
}

async fn bulk_checkout(
  State(state): State<AppState>,
  headers: HeaderMap,
  Path(activity_id): Path<String>,
  Json(request): Json<BulkCheckoutRequest>,
) -> Result<Json<BulkCheckoutResponse>, AppError> {
  let current_user = require_current_user(&headers, &state).await?;
  let response = staff_service::bulk_checkout(
    &state,
    &current_user,
    &activity_id,
    request.confirm,
    &request.reason,
  )
  .await?;
  Ok(Json(response))
}
