use super::ActivityRow;
use super::RawActivityRow;
use super::materialize_activity_row;
use crate::error::AppError;
use sqlx::MySqlPool;

/// 详情查询继续由仓储直接补齐统计字段，避免 service 在读路径二次聚合。
/// 这里只有按主键读取一个活动的职责，不再混入列表和用户状态查询。
pub async fn find_activity_by_id(
  pool: &MySqlPool,
  legacy_activity_id: i64,
) -> Result<Option<ActivityRow>, AppError> {
  let raw_row = sqlx::query_as::<_, RawActivityRow>(
    r#"
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
      WHERE a.id = ?
      GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
      LIMIT 1
    "#,
  )
  .bind(legacy_activity_id)
  .fetch_optional(pool)
  .await
  .map_err(|error| AppError::internal(format!("读取活动详情失败：{error}")))?;

  raw_row.map(materialize_activity_row).transpose()
}
