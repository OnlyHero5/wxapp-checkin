use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::error::AppError;
use crate::service::staff_service;
pub use super::staff_contracts::{
  ActivityRosterItem, ActivityRosterResponse, AttendanceAdjustmentInput,
  AttendanceAdjustmentPatch, AttendanceAdjustmentRequest, AttendanceAdjustmentResponse,
  BulkCheckoutInput, BulkCheckoutRequest, BulkCheckoutResponse,
};
use axum::Json;
use axum::Router;
use axum::extract::{Path, State};
use axum::routing::{get, post};

pub fn router() -> Router<AppState> {
  Router::new()
    .route("/activities/{activity_id}/roster", get(get_roster))
    .route(
      "/activities/{activity_id}/attendance-adjustments",
      post(adjust_attendance),
    )
    .route(
      "/activities/{activity_id}/bulk-checkout",
      post(bulk_checkout),
    )
}

async fn get_roster(
  State(state): State<AppState>,
  current_user: CurrentUser,
  Path(activity_id): Path<String>,
) -> Result<Json<ActivityRosterResponse>, AppError> {
  let response = staff_service::get_roster(&state, &current_user, &activity_id).await?;
  Ok(Json(response))
}

async fn adjust_attendance(
  State(state): State<AppState>,
  current_user: CurrentUser,
  Path(activity_id): Path<String>,
  Json(request): Json<AttendanceAdjustmentRequest>,
) -> Result<Json<AttendanceAdjustmentResponse>, AppError> {
  let input = request.into_input()?;
  let response =
    staff_service::adjust_attendance(&state, &current_user, &activity_id, input).await?;
  Ok(Json(response))
}

async fn bulk_checkout(
  State(state): State<AppState>,
  current_user: CurrentUser,
  Path(activity_id): Path<String>,
  Json(request): Json<BulkCheckoutRequest>,
) -> Result<Json<BulkCheckoutResponse>, AppError> {
  let input = request.into_input()?;
  let response = staff_service::bulk_checkout(&state, &current_user, &activity_id, input).await?;
  Ok(Json(response))
}
