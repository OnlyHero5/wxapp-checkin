use crate::error::AppError;
use serde_json::Value;
use sqlx::Executor;
use sqlx::FromRow;
use sqlx::MySql;
use sqlx::MySqlPool;
use sqlx::QueryBuilder;
use std::collections::HashMap;

/// `suda_log` 既承担普通用户签到流水，也承担 staff 审计。
/// 因此这里把“结构化 JSON content”固定为仓储层统一入口，避免上层各自拼字符串。
pub async fn insert_log<'e, E>(
  executor: E,
  username: &str,
  name: &str,
  path: &str,
  content: &Value,
  ip: &str,
  address: &str,
) -> Result<(), AppError>
where
  E: Executor<'e, Database = sqlx::MySql>,
{
  let content_text = serde_json::to_string(content)
    .map_err(|error| AppError::internal(format!("序列化 suda_log.content 失败：{error}")))?;
  sqlx::query(
    r#"
      INSERT INTO suda_log(username, name, path, content, ip, address)
      VALUES (?, ?, ?, ?, ?, ?)
    "#,
  )
  .bind(username)
  .bind(name)
  .bind(path)
  .bind(content_text)
  .bind(ip)
  .bind(address)
  .execute(executor)
  .await
  .map_err(|error| AppError::internal(format!("写入 suda_log 失败：{error}")))?;
  Ok(())
}

pub async fn find_latest_action_time(
  pool: &MySqlPool,
  username: &str,
  action_type: &str,
  legacy_activity_id: i64,
) -> Result<Option<chrono::NaiveDateTime>, AppError> {
  let activity_pattern = format!("%\"legacy_activity_numeric_id\":{legacy_activity_id}%");
  let action_pattern = format!("%\"action_type\":\"{action_type}\"%");
  sqlx::query_scalar::<_, chrono::NaiveDateTime>(
    r#"
      SELECT CAST(time AS DATETIME)
      FROM suda_log
      WHERE username = ?
        AND content LIKE ?
        AND content LIKE ?
      ORDER BY id DESC
      LIMIT 1
    "#,
  )
  .bind(username)
  .bind(activity_pattern)
  .bind(action_pattern)
  .fetch_optional(pool)
  .await
  .map_err(|error| AppError::internal(format!("查询最新日志时间失败：{error}")))
}

#[derive(Debug, Clone, FromRow)]
struct LatestActionTimeRow {
  username: String,
  action_time: chrono::NaiveDateTime,
}

/// roster 场景下不能继续一人两查 `suda_log`：
/// - 名单人数一多就会退化成明显 N+1；
/// - 这里按 username 批量回收每个成员最近一次 action 时间；
/// - service 层只需要把结果映射回名单项即可。
pub async fn find_latest_action_times(
  pool: &MySqlPool,
  usernames: &[String],
  action_type: &str,
  legacy_activity_id: i64,
) -> Result<HashMap<String, chrono::NaiveDateTime>, AppError> {
  if usernames.is_empty() {
    return Ok(HashMap::new());
  }

  let activity_pattern = format!("%\"legacy_activity_numeric_id\":{legacy_activity_id}%");
  let action_pattern = format!("%\"action_type\":\"{action_type}\"%");
  let mut query_builder = QueryBuilder::<MySql>::new(
    r#"
      SELECT
        CAST(logs.username AS CHAR(20) CHARACTER SET utf8mb4) AS username,
        CAST(logs.time AS DATETIME) AS action_time
      FROM suda_log logs
      INNER JOIN (
        SELECT username, MAX(id) AS latest_id
        FROM suda_log
        WHERE content LIKE
    "#,
  );
  query_builder.push_bind(&activity_pattern);
  query_builder.push(" AND content LIKE ");
  query_builder.push_bind(&action_pattern);
  query_builder.push(" AND username IN (");
  {
    let mut separated = query_builder.separated(", ");
    for username in usernames {
      separated.push_bind(username);
    }
  }
  query_builder.push(
    r#"
        )
        GROUP BY username
      ) latest ON latest.latest_id = logs.id
    "#,
  );

  let rows = query_builder
    .build_query_as::<LatestActionTimeRow>()
    .fetch_all(pool)
    .await
    .map_err(|error| AppError::internal(format!("批量查询最新日志时间失败：{error}")))?;

  let mut time_map = HashMap::with_capacity(rows.len());
  for row in rows {
    time_map.insert(row.username, row.action_time);
  }
  Ok(time_map)
}
