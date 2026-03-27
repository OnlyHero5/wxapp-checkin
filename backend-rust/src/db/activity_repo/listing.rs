use super::ActivityRow;
use crate::error::AppError;
use sqlx::MySqlPool;
const ACTIVITY_KEYWORD_FILTER_SQL: &str = r#"
  (
    LOWER(COALESCE(CAST(a.name AS CHAR(255) CHARACTER SET utf8mb4), '')) LIKE ? ESCAPE '\\'
    OR LOWER(COALESCE(CAST(a.description AS CHAR CHARACTER SET utf8mb4), '')) LIKE ? ESCAPE '\\'
    OR LOWER(COALESCE(CAST(a.location AS CHAR(255) CHARACTER SET utf8mb4), '')) LIKE ? ESCAPE '\\'
    OR CAST(a.id AS CHAR(32)) LIKE ? ESCAPE '\\'
    OR LOWER(CONCAT('legacy_act_', CAST(a.id AS CHAR(32)))) LIKE ? ESCAPE '\\'
  )
"#;

/// 工作人员列表可以看到全部活动，因此查询只关心分页、关键字和统计字段。
/// 文本列继续在 SQL 投影层转为 `utf8mb4`，避免解码规则散落到 service。
pub async fn list_staff_activities(
  pool: &MySqlPool,
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
        WHERE {ACTIVITY_KEYWORD_FILTER_SQL}
        GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
        ORDER BY a.activity_stime DESC, a.id DESC
        LIMIT ? OFFSET ?
      "#,
    );
    return fetch_activities_with_keyword(pool, &keyword_sql, &keyword_pattern, limit, offset)
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
/// 普通用户列表必须只暴露“已报名或已签到过”的活动。
/// 这条查询继续把权限条件留在 SQL 层，避免 service 再做无意义过滤。
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
    return sqlx::query_as::<_, ActivityRow>(&keyword_sql)
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
  use super::build_keyword_pattern;
  use super::escape_like_keyword;

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
