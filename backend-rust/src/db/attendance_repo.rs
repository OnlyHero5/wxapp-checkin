use crate::error::AppError;
use sqlx::{FromRow, MySql, MySqlPool, QueryBuilder, Transaction};

const ATTENDANCE_ROSTER_SELECT_SQL: &str = r#"
  SELECT
    aa.id AS record_id,
    u.id AS user_id,
    CAST(u.username AS CHAR(20) CHARACTER SET utf8mb4) AS student_id,
    CAST(u.name AS CHAR(255) CHARACTER SET utf8mb4) AS name,
    aa.state,
    CAST(aa.check_in AS SIGNED) AS check_in_flag,
    CAST(aa.check_out AS SIGNED) AS check_out_flag
  FROM suda_activity_apply aa
  INNER JOIN suda_user u ON u.username = aa.username
"#;
const ATTENDANCE_ROSTER_ORDER_SQL: &str = "\n  ORDER BY u.username ASC";

/// 签到写路径后续会直接锁定 `suda_activity_apply`。
/// 这里先把读写函数和 roster 查询抽出来，避免业务层自己拼 SQL。
#[derive(Debug, Clone, FromRow)]
pub struct AttendanceRecord {
  pub id: i64,
  pub activity_id: i64,
  pub username: String,
  pub state: i32,
  pub check_in_flag: i64,
  pub check_out_flag: i64,
}

#[derive(Debug, Clone, FromRow)]
pub struct RosterRow {
  pub record_id: i64,
  pub user_id: i64,
  pub student_id: String,
  pub name: String,
  pub state: i32,
  pub check_in_flag: i64,
  pub check_out_flag: i64,
}

#[derive(Debug, Clone, FromRow)]
pub struct ManagedAttendanceRow {
  pub record_id: i64,
  pub user_id: i64,
  pub student_id: String,
  pub name: String,
  pub state: i32,
  pub check_in_flag: i64,
  pub check_out_flag: i64,
}

fn build_attendance_roster_base_sql(where_clause: &str) -> String {
  format!("{ATTENDANCE_ROSTER_SELECT_SQL}{where_clause}")
}

fn build_attendance_roster_sql(where_clause: &str, for_update: bool) -> String {
  // 名单相关查询共享同一组列投影：
  // 1. 避免 roster / 批量签退 / 名单修正三处继续手抄同一段 `SELECT ... CAST(...)`；
  // 2. 保证 utf8mb4_bin 转型口径始终一致；
  // 3. 只把差异保留在 `WHERE` 与是否 `FOR UPDATE`。
  let mut sql = build_attendance_roster_base_sql(where_clause);
  sql.push_str(ATTENDANCE_ROSTER_ORDER_SQL);
  if for_update {
    sql.push_str("\n  FOR UPDATE");
  }
  sql
}

pub async fn find_attendance_for_update(
  tx: &mut Transaction<'_, sqlx::MySql>,
  legacy_activity_id: i64,
  student_id: &str,
) -> Result<Option<AttendanceRecord>, AppError> {
  // 签到写路径读到的用户名/姓名同样来自 `utf8mb4_bin` 文本列。
  // 若不在这里转型，事务入口和 roster 相关接口都会直接因为解码失败而中断。
  sqlx::query_as::<_, AttendanceRecord>(
    r#"
      SELECT
        id,
        activity_id,
        CAST(username AS CHAR(20) CHARACTER SET utf8mb4) AS username,
        state,
        CAST(check_in AS SIGNED) AS check_in_flag,
        CAST(check_out AS SIGNED) AS check_out_flag
      FROM suda_activity_apply
      WHERE activity_id = ? AND username = ?
      LIMIT 1
      FOR UPDATE
    "#,
  )
  .bind(legacy_activity_id)
  .bind(student_id)
  .fetch_optional(&mut **tx)
  .await
  .map_err(|error| AppError::internal(format!("锁定报名记录失败：{error}")))
}

pub async fn update_attendance_flags(
  tx: &mut Transaction<'_, sqlx::MySql>,
  record_id: i64,
  check_in: i64,
  check_out: i64,
) -> Result<(), AppError> {
  sqlx::query(
    r#"
      UPDATE suda_activity_apply
      SET check_in = ?, check_out = ?
      WHERE id = ?
    "#,
  )
  .bind(check_in)
  .bind(check_out)
  .bind(record_id)
  .execute(&mut **tx)
  .await
  .map_err(|error| AppError::internal(format!("更新签到状态失败：{error}")))?;
  Ok(())
}

pub async fn list_roster(
  pool: &MySqlPool,
  legacy_activity_id: i64,
) -> Result<Vec<RosterRow>, AppError> {
  let sql = build_attendance_roster_sql(
    r#"
  WHERE aa.activity_id = ?
    AND aa.state IN (0, 2)
"#,
    false,
  );

  sqlx::query_as::<_, RosterRow>(&sql)
  .bind(legacy_activity_id)
  .fetch_all(pool)
  .await
  .map_err(|error| AppError::internal(format!("读取 roster 失败：{error}")))
}

pub async fn list_checked_in_for_update(
  tx: &mut Transaction<'_, sqlx::MySql>,
  legacy_activity_id: i64,
) -> Result<Vec<ManagedAttendanceRow>, AppError> {
  let sql = build_attendance_roster_sql(
    r#"
  WHERE aa.activity_id = ?
    AND aa.check_in = 1
    AND aa.check_out = 0
"#,
    true,
  );

  sqlx::query_as::<_, ManagedAttendanceRow>(&sql)
  .bind(legacy_activity_id)
  .fetch_all(&mut **tx)
  .await
  .map_err(|error| AppError::internal(format!("锁定批量签退名单失败：{error}")))
}

pub async fn list_by_user_ids_for_update(
  tx: &mut Transaction<'_, sqlx::MySql>,
  legacy_activity_id: i64,
  user_ids: &[i64],
) -> Result<Vec<ManagedAttendanceRow>, AppError> {
  if user_ids.is_empty() {
    return Ok(Vec::new());
  }

  // 项目里已经在别的仓储使用了 `sqlx::QueryBuilder`，
  // 这里统一收口成同一动态 SQL 构造方式，避免继续手拼占位符字符串。
  let base_sql = build_attendance_roster_base_sql(
    r#"
  WHERE aa.activity_id = ?
"#,
  );
  let mut query_builder = QueryBuilder::<MySql>::new(&base_sql);
  query_builder.push_bind(legacy_activity_id);
  query_builder.push(" AND u.id IN (");
  {
    let mut separated = query_builder.separated(", ");
    for user_id in user_ids {
      separated.push_bind(user_id);
    }
  }
  query_builder.push(")");
  query_builder.push(ATTENDANCE_ROSTER_ORDER_SQL);
  query_builder.push("\n  FOR UPDATE");

  query_builder
    .build_query_as::<ManagedAttendanceRow>()
    .fetch_all(&mut **tx)
    .await
    .map_err(|error| AppError::internal(format!("锁定名单修正目标失败：{error}")))
}
