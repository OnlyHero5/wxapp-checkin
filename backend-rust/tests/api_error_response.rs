use axum::http::{Request, StatusCode};
use axum::response::IntoResponse;
use http_body_util::BodyExt;
use tower::ServiceExt;
use wxapp_checkin_backend_rust::api::build_router;
use wxapp_checkin_backend_rust::app_state::AppState;
use wxapp_checkin_backend_rust::config::Config;
use wxapp_checkin_backend_rust::error::AppError;

#[tokio::test]
async fn api_error_response_should_keep_contract_fields_and_http_status() {
  let response =
    AppError::business("forbidden", "权限不足", Some("permission_denied")).into_response();

  assert_eq!(response.status(), StatusCode::FORBIDDEN);

  let bytes = response
    .into_body()
    .collect()
    .await
    .expect("response body")
    .to_bytes();
  let body = serde_json::from_slice::<serde_json::Value>(&bytes).expect("json body");

  assert_eq!(body["status"], "forbidden");
  assert_eq!(body["message"], "权限不足");
  assert_eq!(body["error_code"], "permission_denied");
}

#[tokio::test]
async fn duplicate_business_error_should_report_conflict_status() {
  let response = AppError::business("duplicate", "重复提交", None).into_response();

  assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn health_route_should_match_existing_probe_shape() {
  let config = Config {
    database_url: "mysql://root:root@127.0.0.1:3306/suda_union".to_string(),
    server_port: 8080,
    session_ttl_seconds: 7_200,
    qr_signing_key: "test-secret".to_string(),
    tokio_worker_threads: 2,
    mysql_max_connections: 4,
  };
  let response = build_router(AppState::new(config).expect("app state"))
    .oneshot(
      Request::builder()
        .uri("/actuator/health")
        .body(axum::body::Body::empty())
        .expect("health request"),
    )
    .await
    .expect("health response");

  assert_eq!(response.status(), StatusCode::OK);

  let bytes = response
    .into_body()
    .collect()
    .await
    .expect("response body")
    .to_bytes();
  let body = serde_json::from_slice::<serde_json::Value>(&bytes).expect("json body");

  assert_eq!(body["status"], "UP");
}
