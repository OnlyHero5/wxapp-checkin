use crate::app_state::AppState;
use crate::db;
use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct HealthResponse {
  pub status: &'static str,
}

pub async fn health(State(state): State<AppState>) -> (StatusCode, Json<HealthResponse>) {
  match db::ping(state.pool()).await {
    Ok(()) => (StatusCode::OK, Json(HealthResponse { status: "UP" })),
    Err(_) => (
      StatusCode::SERVICE_UNAVAILABLE,
      Json(HealthResponse { status: "DOWN" })
    ),
  }
}
