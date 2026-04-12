use axum::body::Body;
use axum::extract::FromRequestParts;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::json;
use sqlx::MySqlPool;
use std::error::Error;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tower::ServiceExt;
use wxapp_checkin_backend_rust::api::auth_extractor::CurrentUser;
use wxapp_checkin_backend_rust::api::build_router;
use wxapp_checkin_backend_rust::app_state::AppState;
use wxapp_checkin_backend_rust::config::Config;

type TestResult = Result<(), Box<dyn Error>>;

static UNIQUE_USER_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn test_database_url() -> Option<String> {
  std::env::var("WXAPP_TEST_DATABASE_URL")
    .ok()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
}

fn build_test_state(
  database_url: String,
) -> Result<AppState, wxapp_checkin_backend_rust::error::AppError> {
  AppState::new(Config {
    database_url,
    server_port: 8080,
    session_ttl_seconds: 7_200,
    qr_signing_key: "test-secret".to_string(),
    tokio_worker_threads: 2,
    mysql_max_connections: 4,
  })
}

fn unique_student_id() -> String {
  let now = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .expect("clock should be after unix epoch")
    .as_millis() as u64;
  let sequence = UNIQUE_USER_SEQUENCE.fetch_add(1, Ordering::Relaxed);
  format!("9{:010}", (now + sequence) % 10_000_000_000)
}

async fn insert_temp_user(
  pool: &MySqlPool,
  student_id: &str,
  password: &str,
  invalid: bool,
) -> Result<i64, Box<dyn Error>> {
  let password_hash = bcrypt::hash(password, 4)?;
  let result = sqlx::query(
    r#"
      INSERT INTO suda_user(username, password, name, invalid, role, email, major, grade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    "#,
  )
  .bind(student_id)
  .bind(password_hash)
  .bind(format!("测试用户{student_id}"))
  .bind(if invalid { 1_u8 } else { 0_u8 })
  .bind(4_i32)
  .bind(format!("{student_id}@example.com"))
  .bind("Software Engineering")
  .bind("2025")
  .execute(pool)
  .await?;

  Ok(result.last_insert_id() as i64)
}

async fn delete_temp_user(pool: &MySqlPool, student_id: &str) -> Result<(), Box<dyn Error>> {
  sqlx::query("DELETE FROM suda_department_u WHERE username = ?")
    .bind(student_id)
    .execute(pool)
    .await?;
  sqlx::query("DELETE FROM suda_user WHERE username = ?")
    .bind(student_id)
    .execute(pool)
    .await?;
  Ok(())
}

#[tokio::test]
async fn disabled_account_should_not_login() -> TestResult {
  let Some(database_url) = test_database_url() else {
    return Ok(());
  };
  let state = build_test_state(database_url)?;
  let student_id = unique_student_id();
  insert_temp_user(state.pool(), &student_id, "correct-password", true).await?;

  let outcome: TestResult = async {
    let request = Request::builder()
      .method("POST")
      .uri("/api/web/auth/login")
      .header("content-type", "application/json")
      .body(Body::from(
        json!({
          "student_id": student_id,
          "password": "correct-password"
        })
        .to_string(),
      ))?;
    let response = build_router(state.clone())
      .oneshot(request)
      .await
      .map_err(|error| format!("login request failed: {error}"))?;
    let status = response.status();
    let bytes = response.into_body().collect().await?.to_bytes();
    let body = serde_json::from_slice::<serde_json::Value>(&bytes)?;

    if status != StatusCode::FORBIDDEN {
      return Err(format!("expected 403 for disabled login, got {status}").into());
    }
    if body["error_code"] != "account_disabled" {
      return Err(format!("expected account_disabled, got {body:?}").into());
    }

    Ok(())
  }
  .await;

  delete_temp_user(state.pool(), &student_id).await?;
  outcome
}

#[tokio::test]
async fn disabled_account_should_not_access_with_existing_token() -> TestResult {
  let Some(database_url) = test_database_url() else {
    return Ok(());
  };
  let state = build_test_state(database_url)?;
  let student_id = unique_student_id();
  let user_id = insert_temp_user(state.pool(), &student_id, "correct-password", true).await?;

  let outcome: TestResult = async {
    let session_token =
      state
        .session_token_signer()
        .issue(user_id, &student_id, "normal", SystemTime::now())?;
    let request = Request::builder()
      .uri("/api/web/activities")
      .header("authorization", format!("Bearer {session_token}"))
      .body(Body::empty())?;
    let (mut parts, _) = request.into_parts();
    let error = CurrentUser::from_request_parts(&mut parts, &state)
      .await
      .expect_err("disabled account should not pass auth extractor");

    if error.status() != "forbidden" {
      return Err(format!("expected forbidden error, got {}", error.status()).into());
    }
    if error.error_code() != Some("account_disabled") {
      return Err(format!("expected account_disabled, got {:?}", error.error_code()).into());
    }

    Ok(())
  }
  .await;

  delete_temp_user(state.pool(), &student_id).await?;
  outcome
}

#[tokio::test]
async fn login_route_should_rate_limit_repeated_failures_per_student_id() -> TestResult {
  let Some(database_url) = test_database_url() else {
    return Ok(());
  };
  let state = build_test_state(database_url)?;
  let student_id = unique_student_id();
  insert_temp_user(state.pool(), &student_id, "correct-password", false).await?;

  let outcome: TestResult = async {
    let app = build_router(state.clone());
    let mut last_status = StatusCode::OK;
    let mut last_body = serde_json::Value::Null;

    for _ in 0..6 {
      let request = Request::builder()
        .method("POST")
        .uri("/api/web/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(
          json!({
            "student_id": student_id,
            "password": "wrong-password"
          })
          .to_string(),
        ))?;
      let response = app
        .clone()
        .oneshot(request)
        .await
        .map_err(|error| format!("login request failed: {error}"))?;
      last_status = response.status();
      let bytes = response.into_body().collect().await?.to_bytes();
      last_body = serde_json::from_slice::<serde_json::Value>(&bytes)?;
    }

    if last_status != StatusCode::TOO_MANY_REQUESTS {
      return Err(format!("expected 429 after repeated failures, got {last_status}").into());
    }
    if last_body["error_code"] != "rate_limited" {
      return Err(format!("expected rate_limited body, got {last_body:?}").into());
    }

    Ok(())
  }
  .await;

  delete_temp_user(state.pool(), &student_id).await?;
  outcome
}
