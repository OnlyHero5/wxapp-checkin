pub use super::activity_contracts::{
  ActivityDetailResponse, ActivityListQuery, ActivityListResponse, ActivitySummaryItem,
  CodeConsumeRequest, CodeConsumeResponse, CodeSessionQuery, CodeSessionResponse,
};
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::error::AppError;
use crate::service::activity_service;
use crate::service::attendance_service;
use axum::Json;
use axum::Router;
use axum::extract::{Path, Query, State};
use axum::routing::{get, post};

pub fn router() -> Router<AppState> {
  Router::new()
    .route("/", get(list_activities))
    .route("/{activity_id}", get(get_activity_detail))
    .route("/{activity_id}/code-session", get(get_code_session))
    .route("/{activity_id}/code-consume", post(consume_code))
}

async fn list_activities(
  State(state): State<AppState>,
  current_user: CurrentUser,
  Query(query): Query<ActivityListQuery>,
) -> Result<Json<ActivityListResponse>, AppError> {
  let response = activity_service::list_activities(
    &state,
    &current_user,
    query.page,
    query.page_size,
    query.keyword,
  )
  .await?;
  Ok(Json(response))
}

async fn get_activity_detail(
  State(state): State<AppState>,
  current_user: CurrentUser,
  Path(activity_id): Path<String>,
) -> Result<Json<ActivityDetailResponse>, AppError> {
  let response = activity_service::get_activity_detail(&state, &current_user, &activity_id).await?;
  Ok(Json(response))
}

async fn get_code_session(
  State(state): State<AppState>,
  current_user: CurrentUser,
  Path(activity_id): Path<String>,
  Query(query): Query<CodeSessionQuery>,
) -> Result<Json<CodeSessionResponse>, AppError> {
  let response =
    activity_service::issue_code_session(&state, &current_user, &activity_id, &query.action_type)
      .await?;
  Ok(Json(response))
}

async fn consume_code(
  State(state): State<AppState>,
  current_user: CurrentUser,
  Path(activity_id): Path<String>,
  Json(request): Json<CodeConsumeRequest>,
) -> Result<Json<CodeConsumeResponse>, AppError> {
  let response = attendance_service::consume_code(
    &state,
    &current_user,
    &activity_id,
    request.action_type,
    &request.code,
  )
  .await?;
  Ok(Json(response))
}
