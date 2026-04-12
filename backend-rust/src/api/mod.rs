pub mod activity;
mod activity_contracts;
pub mod auth;
pub mod auth_extractor;
pub mod client_ip;
pub mod error_response;
pub mod health;
pub mod staff;
mod staff_contracts;

use crate::app_state::AppState;
use axum::Router;
use axum::routing::get;
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::trace::TraceLayer;

pub fn build_router(state: AppState) -> Router {
  Router::new()
    .route("/actuator/health", get(health::health))
    .route("/health", get(health::health))
    .nest("/api/web/auth", auth::router())
    .nest("/api/web/activities", activity::router())
    .nest("/api/web/staff", staff::router())
    // 响应返回前把 request-id 透回客户端，便于前后端对齐排查。
    .layer(PropagateRequestIdLayer::x_request_id())
    // trace 继续交给 `tower-http`，并夹在 set / propagate 之间，
    // 这样请求进入 trace 前已经有 request-id，响应离开 trace 前也还带着它。
    .layer(TraceLayer::new_for_http())
    // 先在请求入口补齐 request-id：
    // 1. 客户端没带时由框架生成；
    // 2. 客户端带了时保持透传；
    // 3. 后续 trace / 终端日志都可以基于同一条链路标识定位请求。
    .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
    .with_state(state)
}
