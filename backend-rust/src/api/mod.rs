pub mod activity;
pub mod auth;
pub mod auth_extractor;
pub mod error_response;
pub mod health;
pub mod staff;

use crate::app_state::AppState;
use axum::Router;
use axum::routing::get;
use tower_http::trace::TraceLayer;

pub fn build_router(state: AppState) -> Router {
  Router::new()
    .route("/actuator/health", get(health::health))
    .route("/health", get(health::health))
    .nest("/api/web/auth", auth::router())
    .nest("/api/web/activities", activity::router())
    .nest("/api/web/staff", staff::router())
    // 路由层现在显式挂上 `tower-http` trace，而不是只在 Cargo.toml 里声明依赖。
    // 这样所有入口都能复用统一请求日志，不再停留在“框架套壳”状态。
    .layer(TraceLayer::new_for_http())
    .with_state(state)
}
