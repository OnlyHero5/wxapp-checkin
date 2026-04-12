use axum::http::{Request, StatusCode};
use axum::response::IntoResponse;
use http_body_util::BodyExt;
use std::error::Error;
use tower::ServiceExt;
use wxapp_checkin_backend_rust::api::build_router;
use wxapp_checkin_backend_rust::app_state::AppState;
use wxapp_checkin_backend_rust::config::Config;
use wxapp_checkin_backend_rust::error::AppError;

type TestResult = Result<(), Box<dyn Error>>;

fn test_database_url() -> Option<String> {
  std::env::var("WXAPP_TEST_DATABASE_URL")
    .ok()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
}

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
async fn internal_error_response_should_hide_private_details() {
  let response =
    AppError::internal("sqlx decode failed: column password is invalid").into_response();

  assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

  let bytes = response
    .into_body()
    .collect()
    .await
    .expect("response body")
    .to_bytes();
  let body = serde_json::from_slice::<serde_json::Value>(&bytes).expect("json body");

  assert_eq!(body["status"], "error");
  assert_eq!(body["error_code"], "internal_error");
  assert_eq!(body["message"], "系统内部错误，请稍后重试");
  assert!(
    !body["message"]
      .as_str()
      .unwrap_or_default()
      .contains("sqlx decode failed"),
    "client-facing message must not leak internal details"
  );
}

#[tokio::test]
async fn health_route_should_match_existing_probe_shape() -> TestResult {
  let Some(database_url) = test_database_url() else {
    return Ok(());
  };
  let config = Config {
    database_url,
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
  Ok(())
}

#[tokio::test]
async fn health_route_should_report_down_when_database_is_unavailable() {
  let config = Config {
    database_url: "mysql://root:root@127.0.0.1:1/suda_union".to_string(),
    server_port: 8080,
    session_ttl_seconds: 7_200,
    qr_signing_key: "test-secret".to_string(),
    tokio_worker_threads: 2,
    mysql_max_connections: 1,
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

  assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);

  let bytes = response
    .into_body()
    .collect()
    .await
    .expect("response body")
    .to_bytes();
  let body = serde_json::from_slice::<serde_json::Value>(&bytes).expect("json body");

  assert_eq!(body["status"], "DOWN");
}

#[tokio::test]
async fn health_route_should_generate_x_request_id_when_client_does_not_send_one() -> TestResult {
  let Some(database_url) = test_database_url() else {
    return Ok(());
  };
  let config = Config {
    database_url,
    server_port: 8080,
    session_ttl_seconds: 7_200,
    qr_signing_key: "test-secret".to_string(),
    tokio_worker_threads: 2,
    mysql_max_connections: 4,
  };
  let response = build_router(AppState::new(config).expect("app state"))
    .oneshot(
      Request::builder()
        .uri("/health")
        .body(axum::body::Body::empty())
        .expect("health request"),
    )
    .await
    .expect("health response");

  let request_id = response.headers().get("x-request-id");

  assert!(
    request_id.is_some(),
    "router should propagate a generated x-request-id header"
  );
  assert!(
    !request_id
      .and_then(|value| value.to_str().ok())
      .unwrap_or("")
      .trim()
      .is_empty(),
    "generated x-request-id should not be blank"
  );
  Ok(())
}

#[tokio::test]
async fn health_route_should_preserve_incoming_x_request_id() -> TestResult {
  let Some(database_url) = test_database_url() else {
    return Ok(());
  };
  let config = Config {
    database_url,
    server_port: 8080,
    session_ttl_seconds: 7_200,
    qr_signing_key: "test-secret".to_string(),
    tokio_worker_threads: 2,
    mysql_max_connections: 4,
  };
  let response = build_router(AppState::new(config).expect("app state"))
    .oneshot(
      Request::builder()
        .uri("/health")
        .header("x-request-id", "manual-request-id")
        .body(axum::body::Body::empty())
        .expect("health request"),
    )
    .await
    .expect("health response");

  assert_eq!(
    response
      .headers()
      .get("x-request-id")
      .and_then(|value| value.to_str().ok()),
    Some("manual-request-id")
  );
  Ok(())
}
