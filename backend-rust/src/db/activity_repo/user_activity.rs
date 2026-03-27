use super::UserActivityRow;
use super::UserActivityWithActivityIdRow;
use crate::error::AppError;
use sqlx::MySql;
use sqlx::MySqlPool;
use sqlx::QueryBuilder;

/// 列表页批量补查用户状态时，只查“当前页出现的活动”。
/// 这里保留 QueryBuilder，是为了让动态 `IN (...)` 继续由 sqlx 负责占位符生成。
pub async fn find_user_activities(
  pool: &MySqlPool,
  student_id: &str,
  legacy_activity_ids: &[i64],
) -> Result<Vec<UserActivityWithActivityIdRow>, AppError> {
  if legacy_activity_ids.is_empty() {
    return Ok(Vec::new());
  }

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

/// 详情页只需要一个活动对应的一条用户状态，因此保持成单条查询。
/// 这样 service 在详情场景下不会被迫复用批量接口再做额外拆包。
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
