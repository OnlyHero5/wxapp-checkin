use crate::app_state::AppState;
use axum::Json;
use axum::extract::State;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct HealthResponse {
  pub status: &'static str,
}

pub async fn health(State(_state): State<AppState>) -> Json<HealthResponse> {
  Json(HealthResponse { status: "UP" })
}
