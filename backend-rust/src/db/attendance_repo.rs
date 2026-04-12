use crate::error::AppError;
use sqlx::{FromRow, MySql, MySqlPool, QueryBuilder, Transaction};

#[cfg(test)]
use sqlx::Execute;

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
pub struct AttendanceRosterRow {
  pub record_id: i64,
  pub user_id: i64,
  pub student_id: String,
  pub name: String,
  pub state: i32,
  pub check_in_flag: i64,
  pub check_out_flag: i64,
}

pub type RosterRow = AttendanceRosterRow;
pub type ManagedAttendanceRow = AttendanceRosterRow;

fn build_attendance_roster_base_sql(where_clause: &str) -> String {
  format!("{ATTENDANCE_ROSTER_SELECT_SQL}{where_clause}")
}

fn build_attendance_roster_sql(where_clause: &str, for_update: bool) -> String {
  let mut sql = build_attendance_roster_base_sql(where_clause);
  sql.push_str(ATTENDANCE_ROSTER_ORDER_SQL);
  if for_update {
    sql.push_str("\n  FOR UPDATE");
  }
  sql
}

fn build_user_id_lock_query_builder(
  legacy_activity_id: i64,
  user_ids: &[i64],
) -> QueryBuilder<'static, MySql> {
  let mut query_builder = QueryBuilder::<MySql>::new(ATTENDANCE_ROSTER_SELECT_SQL);
  query_builder.push("\n  WHERE aa.activity_id = ");
  query_builder.push_bind(legacy_activity_id);
  query_builder.push("\n    AND u.id IN (");
  {
    let mut separated = query_builder.separated(", ");
    for &user_id in user_ids {
      separated.push_bind(user_id);
    }
  }
  query_builder.push(")");
  query_builder.push(ATTENDANCE_ROSTER_ORDER_SQL);
  query_builder.push("\n  FOR UPDATE");
  query_builder
}

#[cfg(test)]
fn build_user_id_lock_sql(user_id_count: usize) -> String {
  let demo_user_ids = vec![0_i64; user_id_count];
  build_user_id_lock_query_builder(0, &demo_user_ids).build().sql().to_string()
}

pub async fn find_attendance_for_update(
  tx: &mut Transaction<'_, sqlx::MySql>,
  legacy_activity_id: i64,
  student_id: &str,
) -> Result<Option<AttendanceRecord>, AppError> {
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

pub async fn list_anomalous_rows(
  pool: &MySqlPool,
  legacy_activity_id: i64,
) -> Result<Vec<RosterRow>, AppError> {
  let sql = build_attendance_roster_sql(
    r#"
  WHERE aa.activity_id = ?
    AND aa.state IN (0, 2)
    AND aa.check_in = 0
    AND aa.check_out = 1
"#,
    false,
  );

  sqlx::query_as::<_, RosterRow>(&sql)
  .bind(legacy_activity_id)
  .fetch_all(pool)
  .await
    .map_err(|error| AppError::internal(format!("检查异常签到状态失败：{error}")))
}

fn bulk_checkout_target_where_clause() -> &'static str {
  r#"
  WHERE aa.activity_id = ?
    AND aa.state IN (0, 2)
    AND NOT (aa.check_in = 1 AND aa.check_out = 1)
"#
}

#[cfg(test)]
fn build_bulk_checkout_target_sql() -> String {
  build_attendance_roster_sql(bulk_checkout_target_where_clause(), true)
}

pub async fn list_bulk_checkout_targets_for_update(
  tx: &mut Transaction<'_, sqlx::MySql>,
  legacy_activity_id: i64,
) -> Result<Vec<ManagedAttendanceRow>, AppError> {
  let sql = build_attendance_roster_sql(bulk_checkout_target_where_clause(), true);
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
  build_user_id_lock_query_builder(legacy_activity_id, user_ids)
    .build_query_as::<ManagedAttendanceRow>()
    .fetch_all(&mut **tx)
    .await
    .map_err(|error| AppError::internal(format!("锁定名单修正目标失败：{error}")))
}

#[cfg(test)]
#[path = "attendance_repo_tests.rs"]
mod tests;
