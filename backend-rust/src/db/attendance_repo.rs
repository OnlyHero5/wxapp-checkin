use crate::error::AppError;
use sqlx::{FromRow, MySqlPool, Transaction};

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
        username,
        state,
        CAST(check_in AS UNSIGNED) AS check_in_flag,
        CAST(check_out AS UNSIGNED) AS check_out_flag
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
  sqlx::query_as::<_, RosterRow>(
    r#"
      SELECT
        aa.id AS record_id,
        u.id AS user_id,
        u.username AS student_id,
        u.name,
        aa.state,
        CAST(aa.check_in AS UNSIGNED) AS check_in_flag,
        CAST(aa.check_out AS UNSIGNED) AS check_out_flag
      FROM suda_activity_apply aa
      INNER JOIN suda_user u ON u.username = aa.username
      WHERE aa.activity_id = ?
        AND aa.state IN (0, 2)
      ORDER BY u.username ASC
    "#,
  )
  .bind(legacy_activity_id)
  .fetch_all(pool)
  .await
  .map_err(|error| AppError::internal(format!("读取 roster 失败：{error}")))
}

pub async fn list_checked_in_for_update(
  tx: &mut Transaction<'_, sqlx::MySql>,
  legacy_activity_id: i64,
) -> Result<Vec<ManagedAttendanceRow>, AppError> {
  sqlx::query_as::<_, ManagedAttendanceRow>(
    r#"
      SELECT
        aa.id AS record_id,
        u.id AS user_id,
        u.username AS student_id,
        u.name,
        aa.state,
        CAST(aa.check_in AS UNSIGNED) AS check_in_flag,
        CAST(aa.check_out AS UNSIGNED) AS check_out_flag
      FROM suda_activity_apply aa
      INNER JOIN suda_user u ON u.username = aa.username
      WHERE aa.activity_id = ?
        AND aa.check_in = 1
        AND aa.check_out = 0
      ORDER BY u.username ASC
      FOR UPDATE
    "#,
  )
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

  let placeholders = std::iter::repeat_n("?", user_ids.len()).collect::<Vec<_>>().join(", ");
  let sql = format!(
    r#"
      SELECT
        aa.id AS record_id,
        u.id AS user_id,
        u.username AS student_id,
        u.name,
        aa.state,
        CAST(aa.check_in AS UNSIGNED) AS check_in_flag,
        CAST(aa.check_out AS UNSIGNED) AS check_out_flag
      FROM suda_activity_apply aa
      INNER JOIN suda_user u ON u.username = aa.username
      WHERE aa.activity_id = ?
        AND u.id IN ({placeholders})
      ORDER BY u.username ASC
      FOR UPDATE
    "#
  );

  let mut query = sqlx::query_as::<_, ManagedAttendanceRow>(&sql).bind(legacy_activity_id);
  for user_id in user_ids {
    query = query.bind(*user_id);
  }

  query
    .fetch_all(&mut **tx)
    .await
    .map_err(|error| AppError::internal(format!("锁定名单修正目标失败：{error}")))
}
