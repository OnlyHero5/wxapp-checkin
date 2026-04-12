use axum::response::IntoResponse;
use http_body_util::BodyExt;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use wxapp_checkin_backend_rust::token::SessionTokenSigner;

#[test]
fn session_token_should_round_trip_claims() {
  let signer = SessionTokenSigner::new("test-secret", 7_200);
  let issued_at = UNIX_EPOCH + Duration::from_secs(1_700_000_000);

  let token = signer
    .issue(7, "2025000007", "staff", issued_at)
    .expect("issue token");
  let claims = signer.verify(&token, issued_at).expect("verify token");

  assert_eq!(claims.uid, 7);
  assert_eq!(claims.student_id, "2025000007");
  assert_eq!(claims.role, "staff");
}

#[test]
fn expired_session_token_should_be_rejected() {
  let signer = SessionTokenSigner::new("test-secret", 10);
  let issued_at = UNIX_EPOCH + Duration::from_secs(1_700_000_000);

  let token = signer
    .issue(11, "2025000011", "normal", issued_at)
    .expect("issue token");
  let error = signer
    .verify(&token, issued_at + Duration::from_secs(11))
    .expect_err("token should expire");

  assert_eq!(error.status(), "forbidden");
  assert_eq!(error.error_code(), Some("session_expired"));
}

#[test]
fn tampered_session_token_should_be_rejected() {
  let signer = SessionTokenSigner::new("test-secret", 7_200);
  let issued_at = UNIX_EPOCH + Duration::from_secs(1_700_000_000);

  let mut token = signer
    .issue(7, "2025000007", "staff", issued_at)
    .expect("issue token");
  token.push('x');

  let error = signer
    .verify(&token, SystemTime::now())
    .expect_err("tampered token should fail");

  assert_eq!(error.status(), "forbidden");
  assert_eq!(error.error_code(), Some("session_expired"));
}

#[tokio::test]
async fn token_internal_errors_should_be_sanitized_in_http_response() {
  let signer = SessionTokenSigner::new("test-secret", 7_200);
  let error = signer
    .issue(
      7,
      "2025000007",
      "staff",
      UNIX_EPOCH - Duration::from_secs(1),
    )
    .expect_err("pre-epoch issue time should fail");

  let response = error.into_response();
  let bytes = response
    .into_body()
    .collect()
    .await
    .expect("response body")
    .to_bytes();
  let body = serde_json::from_slice::<serde_json::Value>(&bytes).expect("json body");

  assert_eq!(body["error_code"], "internal_error");
  assert_eq!(body["message"], "系统内部错误，请稍后重试");
}
