use crate::error::AppError;
use sqlx::{FromRow, MySql, MySqlPool, QueryBuilder};

const ACTIVITY_KEYWORD_FILTER_SQL: &str = r#"
  (
    LOWER(COALESCE(CAST(a.name AS CHAR(255) CHARACTER SET utf8mb4), '')) LIKE ? ESCAPE '\\'
    OR LOWER(COALESCE(CAST(a.description AS CHAR CHARACTER SET utf8mb4), '')) LIKE ? ESCAPE '\\'
    OR LOWER(COALESCE(CAST(a.location AS CHAR(255) CHARACTER SET utf8mb4), '')) LIKE ? ESCAPE '\\'
    OR CAST(a.id AS CHAR(32)) LIKE ? ESCAPE '\\'
    OR LOWER(CONCAT('legacy_act_', CAST(a.id AS CHAR(32)))) LIKE ? ESCAPE '\\'
  )
"#;

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

#[derive(Debug, Clone, FromRow)]
pub struct UserActivityWithActivityIdRow {
  pub legacy_activity_id: i64,
  pub username: String,
  pub state: i32,
  pub check_in_flag: i64,
  pub check_out_flag: i64,
}

pub async fn list_staff_activities(
  pool: &MySqlPool,
  limit: i64,
  offset: i64,
  keyword: Option<&str>,
) -> Result<Vec<ActivityRow>, AppError> {
  // 正式库活动表的文本列同样使用 `utf8mb4_bin`，
  // 这里统一在 SQL 投影层转成字符型，避免列表/详情/报名状态读取全部受影响。
  if let Some(keyword_pattern) = keyword.map(build_keyword_pattern) {
    let keyword_sql = format!(
      r#"
          SELECT
            a.id AS legacy_activity_id,
            CAST(a.name AS CHAR(255) CHARACTER SET utf8mb4) AS activity_title,
            CAST(a.description AS CHAR CHARACTER SET utf8mb4) AS description,
            CAST(a.location AS CHAR(255) CHARACTER SET utf8mb4) AS location,
            CAST(a.activity_stime AS DATETIME) AS activity_stime,
            CAST(a.activity_etime AS DATETIME) AS activity_etime,
            a.type AS legacy_type,
            a.state AS legacy_state,
            CAST(COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS SIGNED) AS registered_count,
            CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkin_count,
            CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkout_count
          FROM suda_activity a
          LEFT JOIN suda_activity_apply aa ON aa.activity_id = a.id
          WHERE {ACTIVITY_KEYWORD_FILTER_SQL}
          GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
          ORDER BY a.activity_stime DESC, a.id DESC
          LIMIT ? OFFSET ?
      "#,
    );
    return fetch_activities_with_keyword(
      pool,
      &keyword_sql,
      &keyword_pattern,
      limit,
      offset,
    )
    .await;
  }

  fetch_activities(
    pool,
    r#"
      SELECT
        a.id AS legacy_activity_id,
        CAST(a.name AS CHAR(255) CHARACTER SET utf8mb4) AS activity_title,
        CAST(a.description AS CHAR CHARACTER SET utf8mb4) AS description,
        CAST(a.location AS CHAR(255) CHARACTER SET utf8mb4) AS location,
        CAST(a.activity_stime AS DATETIME) AS activity_stime,
        CAST(a.activity_etime AS DATETIME) AS activity_etime,
        a.type AS legacy_type,
        a.state AS legacy_state,
        CAST(COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS SIGNED) AS registered_count,
        CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkin_count,
        CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkout_count
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
  keyword: Option<&str>,
) -> Result<Vec<ActivityRow>, AppError> {
  if let Some(keyword_pattern) = keyword.map(build_keyword_pattern) {
    let keyword_sql = format!(
      r#"
          SELECT
            a.id AS legacy_activity_id,
            CAST(a.name AS CHAR(255) CHARACTER SET utf8mb4) AS activity_title,
            CAST(a.description AS CHAR CHARACTER SET utf8mb4) AS description,
            CAST(a.location AS CHAR(255) CHARACTER SET utf8mb4) AS location,
            CAST(a.activity_stime AS DATETIME) AS activity_stime,
            CAST(a.activity_etime AS DATETIME) AS activity_etime,
            a.type AS legacy_type,
            a.state AS legacy_state,
            CAST(COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS SIGNED) AS registered_count,
            CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkin_count,
            CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkout_count
          FROM suda_activity a
          LEFT JOIN suda_activity_apply aa ON aa.activity_id = a.id
          WHERE EXISTS (
            SELECT 1
            FROM suda_activity_apply mine
            WHERE mine.activity_id = a.id
              AND mine.username = ?
              AND (mine.state IN (0, 2) OR mine.check_in = 1)
          )
            AND {ACTIVITY_KEYWORD_FILTER_SQL}
          GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
          ORDER BY a.activity_stime DESC, a.id DESC
          LIMIT ? OFFSET ?
      "#,
    );
    return sqlx::query_as::<_, ActivityRow>(
      &keyword_sql,
    )
    .bind(student_id)
    .bind(&keyword_pattern)
    .bind(&keyword_pattern)
    .bind(&keyword_pattern)
    .bind(&keyword_pattern)
    .bind(&keyword_pattern)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|error| AppError::internal(format!("读取普通用户活动列表失败：{error}")));
  }

  sqlx::query_as::<_, ActivityRow>(
    r#"
      SELECT
        a.id AS legacy_activity_id,
        CAST(a.name AS CHAR(255) CHARACTER SET utf8mb4) AS activity_title,
        CAST(a.description AS CHAR CHARACTER SET utf8mb4) AS description,
        CAST(a.location AS CHAR(255) CHARACTER SET utf8mb4) AS location,
        CAST(a.activity_stime AS DATETIME) AS activity_stime,
        CAST(a.activity_etime AS DATETIME) AS activity_etime,
        a.type AS legacy_type,
        a.state AS legacy_state,
        CAST(COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS SIGNED) AS registered_count,
        CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkin_count,
        CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkout_count
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

pub async fn find_user_activities(
  pool: &MySqlPool,
  student_id: &str,
  legacy_activity_ids: &[i64],
) -> Result<Vec<UserActivityWithActivityIdRow>, AppError> {
  if legacy_activity_ids.is_empty() {
    return Ok(Vec::new());
  }

  // 列表页只需要“当前这一页活动”的用户状态，不需要把用户的全部报名历史都扫出来。
  // 这里用 QueryBuilder 只拼当前页活动 ID 的 IN 子句，避免 service 层继续逐条查询。
  let mut query_builder = QueryBuilder::<MySql>::new(
    r#"
      SELECT
        CAST(activity_id AS SIGNED) AS legacy_activity_id,
        CAST(username AS CHAR(20) CHARACTER SET utf8mb4) AS username,
        state,
        CAST(check_in AS SIGNED) AS check_in_flag,
        CAST(check_out AS SIGNED) AS check_out_flag
      FROM suda_activity_apply
      WHERE username = 
    "#,
  );
  query_builder.push_bind(student_id);
  query_builder.push(" AND activity_id IN (");
  {
    let mut separated = query_builder.separated(", ");
    for legacy_activity_id in legacy_activity_ids {
      separated.push_bind(legacy_activity_id);
    }
  }
  query_builder.push(")");

  query_builder
    .build_query_as::<UserActivityWithActivityIdRow>()
    .fetch_all(pool)
    .await
    .map_err(|error| AppError::internal(format!("批量读取用户活动状态失败：{error}")))
}

pub async fn find_activity_by_id(
  pool: &MySqlPool,
  legacy_activity_id: i64,
) -> Result<Option<ActivityRow>, AppError> {
  sqlx::query_as::<_, ActivityRow>(
    r#"
      SELECT
        a.id AS legacy_activity_id,
        CAST(a.name AS CHAR(255) CHARACTER SET utf8mb4) AS activity_title,
        CAST(a.description AS CHAR CHARACTER SET utf8mb4) AS description,
        CAST(a.location AS CHAR(255) CHARACTER SET utf8mb4) AS location,
        CAST(a.activity_stime AS DATETIME) AS activity_stime,
        CAST(a.activity_etime AS DATETIME) AS activity_etime,
        a.type AS legacy_type,
        a.state AS legacy_state,
        CAST(COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS SIGNED) AS registered_count,
        CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkin_count,
        CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkout_count
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
        CAST(username AS CHAR(20) CHARACTER SET utf8mb4) AS username,
        state,
        CAST(check_in AS SIGNED) AS check_in_flag,
        CAST(check_out AS SIGNED) AS check_out_flag
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

async fn fetch_activities_with_keyword(
  pool: &MySqlPool,
  sql: &str,
  keyword_pattern: &str,
  limit: i64,
  offset: i64,
) -> Result<Vec<ActivityRow>, AppError> {
  sqlx::query_as::<_, ActivityRow>(sql)
    .bind(keyword_pattern)
    .bind(keyword_pattern)
    .bind(keyword_pattern)
    .bind(keyword_pattern)
    .bind(keyword_pattern)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|error| AppError::internal(format!("读取活动列表失败：{error}")))
}

fn escape_like_keyword(value: &str) -> String {
  value
    .replace('\\', "\\\\")
    .replace('%', "\\%")
    .replace('_', "\\_")
}

fn build_keyword_pattern(value: &str) -> String {
  format!("%{}%", escape_like_keyword(&value.trim().to_lowercase()))
}

#[cfg(test)]
mod tests {
  use super::{build_keyword_pattern, escape_like_keyword};

  #[test]
  fn escape_like_keyword_should_escape_percent_and_underscore() {
    assert_eq!(escape_like_keyword("奖学金_补录%"), "奖学金\\_补录\\%");
  }

  #[test]
  fn build_keyword_pattern_should_keep_legacy_activity_prefix_literal() {
    assert_eq!(
      build_keyword_pattern("legacy_act_123"),
      "%legacy\\_act\\_123%"
    );
  }
}
