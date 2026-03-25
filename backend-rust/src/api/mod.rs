pub mod auth;
pub mod error_response;
pub mod health;
pub mod auth_extractor;
pub mod activity;
pub mod staff;

use crate::app_state::AppState;
use axum::Router;
use axum::routing::get;

pub fn build_router(state: AppState) -> Router {
  Router::new()
    .route("/actuator/health", get(health::health))
    .route("/health", get(health::health))
    .nest("/api/web/auth", auth::router())
    .nest("/api/web/activities", activity::router())
    .nest("/api/web/staff", staff::router())
    .with_state(state)
}
