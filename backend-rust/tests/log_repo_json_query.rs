use sqlx::MySqlPool;
use sqlx::mysql::MySqlPoolOptions;
use std::error::Error;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use wxapp_checkin_backend_rust::db::log_repo;

type TestResult = Result<(), Box<dyn Error>>;

static UNIQUE_LOG_SEQUENCE: AtomicU64 = AtomicU64::new(0);

async fn connect_test_pool() -> Option<MySqlPool> {
  let database_url = match std::env::var("WXAPP_TEST_DATABASE_URL") {
    Ok(value) => value,
    Err(_) => return None,
  };

  Some(
    MySqlPoolOptions::new()
      .max_connections(1)
      .connect(&database_url)
      .await
      .expect("connect test database"),
  )
}

fn unique_student_id() -> String {
  let now = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .expect("clock should be after unix epoch")
    .as_millis() as u64;
  let sequence = UNIQUE_LOG_SEQUENCE.fetch_add(1, Ordering::Relaxed);
  format!("8{:010}", (now + sequence) % 10_000_000_000)
}

#[tokio::test]
async fn log_repo_should_match_top_level_json_fields_for_latest_action_time() -> TestResult {
  let Some(pool) = connect_test_pool().await else {
    return Ok(());
  };
  let username = unique_student_id();

  let outcome: TestResult = async {
    sqlx::query(
      r#"
        INSERT INTO suda_log(username, name, path, content, time, ip, address)
        VALUES (?, ?, ?, ?, '2026-04-12 10:00:00', ?, ?)
      "#,
    )
    .bind(&username)
    .bind("测试用户")
    .bind("/api/web/activities/legacy_act_103/checkin")
    .bind(r#"{"legacy_activity_numeric_id":103,"action_type":"checkin"}"#)
    .bind("127.0.0.1")
    .bind("Shanghai")
    .execute(&pool)
    .await?;

    sqlx::query(
      r#"
        INSERT INTO suda_log(username, name, path, content, time, ip, address)
        VALUES (?, ?, ?, ?, '2026-04-12 10:05:00', ?, ?)
      "#,
    )
    .bind(&username)
    .bind("测试用户")
    .bind("/api/web/activities/legacy_act_999/checkout")
    .bind(
      r#"{"legacy_activity_numeric_id":999,"action_type":"checkout","meta":{"legacy_activity_numeric_id":103,"action_type":"checkin"}}"#,
    )
    .bind("127.0.0.1")
    .bind("Shanghai")
    .execute(&pool)
    .await?;

    let latest = log_repo::find_latest_action_time(&pool, &username, "checkin", 103)
      .await?
      .ok_or("expected latest action time")?;

    if latest.to_string() != "2026-04-12 10:00:00" {
      return Err(format!("expected top-level row time, got {latest}").into());
    }

    Ok(())
  }
  .await;

  sqlx::query("DELETE FROM suda_log WHERE username = ?")
    .bind(&username)
    .execute(&pool)
    .await?;
  outcome
}

#[tokio::test]
async fn log_repo_should_match_top_level_json_fields_for_batch_latest_action_times() -> TestResult {
  let Some(pool) = connect_test_pool().await else {
    return Ok(());
  };
  let username = unique_student_id();

  let outcome: TestResult = async {
    sqlx::query(
      r#"
        INSERT INTO suda_log(username, name, path, content, time, ip, address)
        VALUES (?, ?, ?, ?, '2026-04-12 11:00:00', ?, ?)
      "#,
    )
    .bind(&username)
    .bind("测试用户")
    .bind("/api/web/activities/legacy_act_103/checkout")
    .bind(r#"{"legacy_activity_numeric_id":103,"action_type":"checkout"}"#)
    .bind("127.0.0.1")
    .bind("Shanghai")
    .execute(&pool)
    .await?;

    sqlx::query(
      r#"
        INSERT INTO suda_log(username, name, path, content, time, ip, address)
        VALUES (?, ?, ?, ?, '2026-04-12 11:05:00', ?, ?)
      "#,
    )
    .bind(&username)
    .bind("测试用户")
    .bind("/api/web/activities/legacy_act_999/checkin")
    .bind(
      r#"{"legacy_activity_numeric_id":999,"action_type":"checkin","meta":{"legacy_activity_numeric_id":103,"action_type":"checkout"}}"#,
    )
    .bind("127.0.0.1")
    .bind("Shanghai")
    .execute(&pool)
    .await?;

    let latest =
      log_repo::find_latest_action_times(&pool, std::slice::from_ref(&username), "checkout", 103)
        .await?;
    let action_time = latest
      .get(&username)
      .ok_or("expected batch latest action time")?;

    if action_time.to_string() != "2026-04-12 11:00:00" {
      return Err(format!("expected top-level batch row time, got {action_time}").into());
    }

    Ok(())
  }
  .await;

  sqlx::query("DELETE FROM suda_log WHERE username = ?")
    .bind(&username)
    .execute(&pool)
    .await?;
  outcome
}
