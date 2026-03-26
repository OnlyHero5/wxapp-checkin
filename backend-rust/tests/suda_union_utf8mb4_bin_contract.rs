use sqlx::MySqlPool;
use sqlx::mysql::MySqlPoolOptions;
use wxapp_checkin_backend_rust::db::{activity_repo, attendance_repo, log_repo, user_repo};

/// 这些契约测试直接对准 `suda_union` 正式库的 `utf8mb4_bin` 文本列。
/// 目的不是验证业务流程本身，而是锁住 Rust 读库映射不会再把文本列解成二进制。
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

#[tokio::test]
async fn user_repo_should_decode_utf8mb4_bin_user_columns() {
  let Some(pool) = connect_test_pool().await else {
    return;
  };

  let user = user_repo::find_user_by_student_id(&pool, "20254227087")
    .await
    .expect("query user")
    .expect("user exists");

  assert_eq!(user.username, "20254227087");
  assert_eq!(user.name, "梁靖松");
  assert_eq!(user.department.as_deref(), Some("主席团"));
}

#[tokio::test]
async fn activity_repo_should_decode_utf8mb4_bin_activity_columns() {
  let Some(pool) = connect_test_pool().await else {
    return;
  };

  let activity = activity_repo::find_activity_by_id(&pool, 101)
    .await
    .expect("query activity")
    .expect("activity exists");

  assert_eq!(activity.activity_title, "AI 工具实战工作坊");
  assert_eq!(activity.location.as_deref(), Some("图书馆创客空间"));
  assert_eq!(
    activity.description.as_deref(),
    Some("面向学生组织的 AI 工具落地训练营。")
  );
}

#[tokio::test]
async fn activity_repo_should_decode_utf8mb4_bin_user_activity_columns() {
  let Some(pool) = connect_test_pool().await else {
    return;
  };

  let row = activity_repo::find_user_activity(&pool, 101, "2025000101")
    .await
    .expect("query user activity")
    .expect("user activity exists");

  assert_eq!(row.username, "2025000101");
}

#[tokio::test]
async fn attendance_repo_should_decode_utf8mb4_bin_attendance_columns() {
  let Some(pool) = connect_test_pool().await else {
    return;
  };

  // 写路径读取也要覆盖到，否则签到/签退仍可能在事务入口炸掉。
  let mut tx = pool.begin().await.expect("begin tx");
  let row = attendance_repo::find_attendance_for_update(&mut tx, 101, "2025000101")
    .await
    .expect("query attendance")
    .expect("attendance exists");
  tx.rollback().await.expect("rollback");

  assert_eq!(row.username, "2025000101");
}

#[tokio::test]
async fn attendance_repo_should_decode_utf8mb4_bin_roster_columns() {
  let Some(pool) = connect_test_pool().await else {
    return;
  };

  let rows = attendance_repo::list_roster(&pool, 101)
    .await
    .expect("query roster");
  let row = rows
    .into_iter()
    .find(|item| item.student_id == "2025000101")
    .expect("target roster row");

  assert_eq!(row.student_id, "2025000101");
  assert_eq!(row.name, "张三");
}

#[tokio::test]
async fn log_repo_should_decode_timestamp_action_time() {
  let Some(pool) = connect_test_pool().await else {
    return;
  };

  let latest = log_repo::find_latest_action_time(&pool, "2025000201", "checkin", 103)
    .await
    .expect("query latest action time");

  assert!(
    latest.is_some(),
    "expected latest checkin log time for activity 103"
  );
}
