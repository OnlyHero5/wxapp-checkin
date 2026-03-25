use crate::error::AppError;
use sqlx::{FromRow, MySqlPool};

/// 活动读路径先按“列表 + 详情”两个查询面建仓储。
/// 统计字段直接在 SQL 里聚合，避免引入额外投影表或内存缓存。
#[derive(Debug, Clone, FromRow)]
pub struct ActivityRow {
  pub legacy_activity_id: i64,
  pub activity_title: String,
  pub description: Option<String>,
  pub location: Option<String>,
  pub activity_stime: chrono::NaiveDateTime,
  pub activity_etime: chrono::NaiveDateTime,
  pub legacy_type: i32,
  pub legacy_state: i32,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
}

#[derive(Debug, Clone, FromRow)]
pub struct UserActivityRow {
  pub username: String,
  pub state: i32,
  pub check_in_flag: i64,
  pub check_out_flag: i64,
}

pub async fn list_staff_activities(
  pool: &MySqlPool,
  limit: i64,
  offset: i64,
) -> Result<Vec<ActivityRow>, AppError> {
  fetch_activities(
    pool,
    r#"
      SELECT
        a.id AS legacy_activity_id,
        a.name AS activity_title,
        a.description,
        a.location,
        a.activity_stime,
        a.activity_etime,
        a.type AS legacy_type,
        a.state AS legacy_state,
        COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS registered_count,
        COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS checkin_count,
        COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS checkout_count
      FROM suda_activity a
      LEFT JOIN suda_activity_apply aa ON aa.activity_id = a.id
      GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
      ORDER BY a.activity_stime DESC, a.id DESC
      LIMIT ? OFFSET ?
    "#,
    limit,
    offset,
  )
  .await
}

pub async fn list_normal_activities(
  pool: &MySqlPool,
  student_id: &str,
  limit: i64,
  offset: i64,
) -> Result<Vec<ActivityRow>, AppError> {
  sqlx::query_as::<_, ActivityRow>(
    r#"
      SELECT
        a.id AS legacy_activity_id,
        a.name AS activity_title,
        a.description,
        a.location,
        a.activity_stime,
        a.activity_etime,
        a.type AS legacy_type,
        a.state AS legacy_state,
        COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS registered_count,
        COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS checkin_count,
        COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS checkout_count
      FROM suda_activity a
      LEFT JOIN suda_activity_apply aa ON aa.activity_id = a.id
      WHERE EXISTS (
        SELECT 1
        FROM suda_activity_apply mine
        WHERE mine.activity_id = a.id
          AND mine.username = ?
          AND (mine.state IN (0, 2) OR mine.check_in = 1)
      )
      GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
      ORDER BY a.activity_stime DESC, a.id DESC
      LIMIT ? OFFSET ?
    "#,
  )
  .bind(student_id)
  .bind(limit)
  .bind(offset)
  .fetch_all(pool)
  .await
  .map_err(|error| AppError::internal(format!("读取普通用户活动列表失败：{error}")))
}

pub async fn find_activity_by_id(
  pool: &MySqlPool,
  legacy_activity_id: i64,
) -> Result<Option<ActivityRow>, AppError> {
  sqlx::query_as::<_, ActivityRow>(
    r#"
      SELECT
        a.id AS legacy_activity_id,
        a.name AS activity_title,
        a.description,
        a.location,
        a.activity_stime,
        a.activity_etime,
        a.type AS legacy_type,
        a.state AS legacy_state,
        COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS registered_count,
        COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS checkin_count,
        COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS checkout_count
      FROM suda_activity a
      LEFT JOIN suda_activity_apply aa ON aa.activity_id = a.id
      WHERE a.id = ?
      GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
      LIMIT 1
    "#,
  )
  .bind(legacy_activity_id)
  .fetch_optional(pool)
  .await
  .map_err(|error| AppError::internal(format!("读取活动详情失败：{error}")))
}

pub async fn find_user_activity(
  pool: &MySqlPool,
  legacy_activity_id: i64,
  student_id: &str,
) -> Result<Option<UserActivityRow>, AppError> {
  sqlx::query_as::<_, UserActivityRow>(
    r#"
      SELECT
        username,
        state,
        CAST(check_in AS UNSIGNED) AS check_in_flag,
        CAST(check_out AS UNSIGNED) AS check_out_flag
      FROM suda_activity_apply
      WHERE activity_id = ? AND username = ?
      LIMIT 1
    "#,
  )
  .bind(legacy_activity_id)
  .bind(student_id)
  .fetch_optional(pool)
  .await
  .map_err(|error| AppError::internal(format!("读取用户活动状态失败：{error}")))
}

async fn fetch_activities(
  pool: &MySqlPool,
  sql: &str,
  limit: i64,
  offset: i64,
) -> Result<Vec<ActivityRow>, AppError> {
  sqlx::query_as::<_, ActivityRow>(sql)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|error| AppError::internal(format!("读取活动列表失败：{error}")))
}
