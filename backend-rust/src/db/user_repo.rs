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
  // `suda_union` 正式库把文本列统一建成 `utf8mb4_bin`；
  // sqlx 运行时会把这类列按二进制元数据返回，因此这里显式转回字符型，避免认证链路解码失败。
  sqlx::query_as::<_, UserAuthRecord>(
    r#"
      SELECT
        u.id,
        CAST(u.username AS CHAR(20) CHARACTER SET utf8mb4) AS username,
        CAST(u.password AS CHAR(60) CHARACTER SET utf8mb4) AS password,
        CAST(u.name AS CHAR(255) CHARACTER SET utf8mb4) AS name,
        u.role,
        CAST(u.invalid AS SIGNED) AS invalid,
        CAST(d.department AS CHAR(255) CHARACTER SET utf8mb4) AS department
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
