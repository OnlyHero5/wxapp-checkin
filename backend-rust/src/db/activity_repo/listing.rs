use super::ActivityRow;
use super::RawActivityRow;
use super::materialize_activity_row;
use crate::error::AppError;
use sqlx::{MySql, MySqlPool, QueryBuilder};

const ACTIVITY_SELECT_SQL: &str = r#"
  SELECT
    a.id AS legacy_activity_id,
    CAST(a.name AS CHAR(255) CHARACTER SET utf8mb4) AS activity_title,
    CAST(a.description AS CHAR CHARACTER SET utf8mb4) AS description,
    CAST(a.location AS CHAR(255) CHARACTER SET utf8mb4) AS location,
    DATE_FORMAT(a.activity_stime, '%Y-%m-%d %H:%i:%s') AS activity_stime,
    DATE_FORMAT(a.activity_etime, '%Y-%m-%d %H:%i:%s') AS activity_etime,
    a.type AS legacy_type,
    a.state AS legacy_state,
    CAST(COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS SIGNED) AS registered_count,
    CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkin_count,
    CAST(COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS SIGNED) AS checkout_count
  FROM suda_activity a
  LEFT JOIN suda_activity_apply aa ON aa.activity_id = a.id
"#;

const ACTIVITY_GROUP_AND_PAGE_SQL: &str = r#"
  GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
  ORDER BY a.activity_stime DESC, a.id DESC
  LIMIT
"#;

enum ListingScope<'a> {
  Staff,
  Normal { student_id: &'a str },
}

/// 工作人员列表可以看到全部活动，因此这里只需要声明“staff 口径”。
/// 具体 SQL 拼接统一交给下方共享构造函数，避免 staff / normal 两边继续复制整段查询。
pub async fn list_staff_activities(
  pool: &MySqlPool,
  limit: i64,
  offset: i64,
  keyword: Option<&str>,
) -> Result<Vec<ActivityRow>, AppError> {
  list_activities(pool, ListingScope::Staff, limit, offset, keyword).await
}

/// 普通用户列表必须只暴露“已报名或已签到过”的活动。
/// 这个可见性规则继续留在 SQL 层，但不再复制一整份 SELECT / GROUP / ORDER 语句。
pub async fn list_normal_activities(
  pool: &MySqlPool,
  student_id: &str,
  limit: i64,
  offset: i64,
  keyword: Option<&str>,
) -> Result<Vec<ActivityRow>, AppError> {
  list_activities(
    pool,
    ListingScope::Normal { student_id },
    limit,
    offset,
    keyword,
  )
  .await
}

async fn list_activities(
  pool: &MySqlPool,
  scope: ListingScope<'_>,
  limit: i64,
  offset: i64,
  keyword: Option<&str>,
) -> Result<Vec<ActivityRow>, AppError> {
  let mut query_builder = QueryBuilder::<MySql>::new(ACTIVITY_SELECT_SQL);
  let mut has_where_clause = false;

  append_visibility_clause(&mut query_builder, &mut has_where_clause, scope);
  append_keyword_clause(
    &mut query_builder,
    &mut has_where_clause,
    keyword.map(build_keyword_pattern),
  );

  query_builder.push(ACTIVITY_GROUP_AND_PAGE_SQL);
  query_builder.push_bind(limit);
  query_builder.push(" OFFSET ");
  query_builder.push_bind(offset);

  let raw_rows = query_builder
    .build_query_as::<RawActivityRow>()
    .fetch_all(pool)
    .await
    .map_err(|error| AppError::internal(format!("读取活动列表失败：{error}")))?;

  raw_rows.into_iter().map(materialize_activity_row).collect()
}

fn append_visibility_clause(
  query_builder: &mut QueryBuilder<'_, MySql>,
  has_where_clause: &mut bool,
  scope: ListingScope<'_>,
) {
  match scope {
    ListingScope::Staff => {}
    ListingScope::Normal { student_id } => {
      push_where_prefix(query_builder, has_where_clause);
      query_builder.push(
        r#"
          EXISTS (
            SELECT 1
            FROM suda_activity_apply mine
            WHERE mine.activity_id = a.id
              AND mine.username =
        "#,
      );
      query_builder.push_bind(student_id.to_string());
      query_builder.push(
        r#"
              AND (mine.state IN (0, 2) OR mine.check_in = 1)
          )
        "#,
      );
    }
  }
}

fn append_keyword_clause(
  query_builder: &mut QueryBuilder<'_, MySql>,
  has_where_clause: &mut bool,
  keyword_pattern: Option<String>,
) {
  let Some(keyword_pattern) = keyword_pattern else {
    return;
  };

  push_where_prefix(query_builder, has_where_clause);
  query_builder.push("(");
  push_keyword_like(
    query_builder,
    "LOWER(COALESCE(CAST(a.name AS CHAR(255) CHARACTER SET utf8mb4), ''))",
    &keyword_pattern,
  );
  query_builder.push(" OR ");
  push_keyword_like(
    query_builder,
    "LOWER(COALESCE(CAST(a.description AS CHAR CHARACTER SET utf8mb4), ''))",
    &keyword_pattern,
  );
  query_builder.push(" OR ");
  push_keyword_like(
    query_builder,
    "LOWER(COALESCE(CAST(a.location AS CHAR(255) CHARACTER SET utf8mb4), ''))",
    &keyword_pattern,
  );
  query_builder.push(" OR CAST(a.id AS CHAR(32)) LIKE ");
  query_builder.push_bind(keyword_pattern.clone());
  query_builder.push(" ESCAPE '\\\\'");
  query_builder.push(" OR LOWER(CONCAT('legacy_act_', CAST(a.id AS CHAR(32)))) LIKE ");
  query_builder.push_bind(keyword_pattern);
  query_builder.push(" ESCAPE '\\\\')");
}

fn push_keyword_like(
  query_builder: &mut QueryBuilder<'_, MySql>,
  sql_expression: &str,
  keyword_pattern: &str,
) {
  query_builder.push(sql_expression);
  query_builder.push(" LIKE ");
  query_builder.push_bind(keyword_pattern.to_string());
  query_builder.push(" ESCAPE '\\\\'");
}

fn push_where_prefix(query_builder: &mut QueryBuilder<'_, MySql>, has_where_clause: &mut bool) {
  if *has_where_clause {
    query_builder.push(" AND ");
  } else {
    query_builder.push(" WHERE ");
    *has_where_clause = true;
  }
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
#[path = "listing_tests.rs"]
mod tests;
