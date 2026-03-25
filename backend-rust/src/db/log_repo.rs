use crate::error::AppError;
use serde_json::Value;
use sqlx::MySqlPool;

/// `suda_log` 既承担普通用户签到流水，也承担 staff 审计。
/// 因此这里把“结构化 JSON content”固定为仓储层统一入口，避免上层各自拼字符串。
pub async fn insert_log(
  pool: &MySqlPool,
  username: &str,
  name: &str,
  path: &str,
  content: &Value,
  ip: &str,
  address: &str,
) -> Result<(), AppError> {
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
  .execute(pool)
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
      SELECT time
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
