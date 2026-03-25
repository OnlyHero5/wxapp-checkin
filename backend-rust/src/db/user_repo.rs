use crate::error::AppError;
use sqlx::{FromRow, MySqlPool};

/// 认证链路需要的用户字段只收敛到最小集合。
/// 这里不把 `suda_user` 整表映射进内存对象，避免后续查询继续膨胀。
#[derive(Debug, Clone, FromRow)]
pub struct UserAuthRecord {
  pub id: i64,
  pub username: String,
  pub password: Option<String>,
  pub name: String,
  pub role: i32,
  pub invalid: Option<i8>,
  pub department: Option<String>,
}

pub async fn find_user_by_student_id(
  pool: &MySqlPool,
  student_id: &str,
) -> Result<Option<UserAuthRecord>, AppError> {
  sqlx::query_as::<_, UserAuthRecord>(
    r#"
      SELECT
        u.id,
        u.username,
        u.password,
        u.name,
        u.role,
        u.invalid,
        d.department
      FROM suda_user u
      LEFT JOIN suda_department_u du ON du.username = u.username
      LEFT JOIN suda_department d ON d.id = du.department_id
      WHERE u.username = ?
      LIMIT 1
    "#,
  )
  .bind(student_id)
  .fetch_optional(pool)
  .await
  .map_err(|error| AppError::internal(format!("读取 suda_user 失败：{error}")))
}

pub async fn update_password(
  pool: &MySqlPool,
  student_id: &str,
  password_hash: &str,
) -> Result<(), AppError> {
  sqlx::query(
    r#"
      UPDATE suda_user
      SET password = ?
      WHERE username = ?
    "#,
  )
  .bind(password_hash)
  .bind(student_id)
  .execute(pool)
  .await
  .map_err(|error| AppError::internal(format!("更新 suda_user.password 失败：{error}")))?;
  Ok(())
}

pub async fn update_last_login_time(pool: &MySqlPool, student_id: &str) -> Result<(), AppError> {
  sqlx::query(
    r#"
      UPDATE suda_user
      SET last_login_time = CURRENT_TIMESTAMP
      WHERE username = ?
    "#,
  )
  .bind(student_id)
  .execute(pool)
  .await
  .map_err(|error| AppError::internal(format!("更新最后登录时间失败：{error}")))?;
  Ok(())
}
