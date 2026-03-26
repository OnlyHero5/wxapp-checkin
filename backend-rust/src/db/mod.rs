pub mod activity_repo;
pub mod attendance_repo;
pub mod log_repo;
pub mod user_repo;

use crate::config::Config;
use crate::error::AppError;
use sqlx::MySqlPool;
use sqlx::mysql::MySqlPoolOptions;
use std::time::Duration;

const REQUIRED_TABLES: [&str; 6] = [
  "suda_user",
  "suda_department_u",
  "suda_department",
  "suda_activity",
  "suda_activity_apply",
  "suda_log",
];

/// 启动预检报告只保留运维真正关心的两项：
/// - 当前连到的数据库名
/// - 已经验证可读的关键表列表
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StartupCheckReport {
  pub database_name: String,
  pub verified_tables: Vec<String>,
}

/// MySQL 连接池必须继续服务“小内存、低常驻”的目标。
/// 这里明确压低连接数和生命周期，避免 Rust 服务把数据库连接当成廉价资源无限占着。
pub fn connect_pool(config: &Config) -> Result<MySqlPool, AppError> {
  MySqlPoolOptions::new()
    .max_connections(config.mysql_max_connections)
    .min_connections(0)
    .acquire_timeout(Duration::from_secs(3))
    .idle_timeout(Some(Duration::from_secs(60)))
    .max_lifetime(Some(Duration::from_secs(300)))
    .connect_lazy(&config.database_url)
    .map_err(|error| AppError::invalid_config(format!("初始化 MySQL 连接池失败：{error}")))
}

/// 启动时必须先把数据库与关键表探活做完，再开始对外监听 HTTP。
/// 这样云服务器上如果账号、密码、端口或授权不对，会直接在终端蓝色错误日志里暴露出来。
pub async fn run_startup_checks(pool: &MySqlPool) -> Result<StartupCheckReport, AppError> {
  let database_name = sqlx::query_scalar::<_, Option<String>>("SELECT DATABASE()")
    .fetch_one(pool)
    .await
    .map_err(|error| AppError::invalid_config(format!("连接 suda_union 数据库失败：{error}")))?
    .filter(|value| !value.trim().is_empty())
    .ok_or_else(|| AppError::invalid_config("数据库连接成功，但当前会话没有选中库"))?;

  let mut missing_tables = Vec::new();
  let mut verified_tables = Vec::with_capacity(REQUIRED_TABLES.len());
  for table_name in REQUIRED_TABLES {
    let table_exists = sqlx::query_scalar::<_, i64>(
      r#"
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
      "#,
    )
    .bind(table_name)
    .fetch_one(pool)
    .await
    .map_err(|error| {
      AppError::internal(format!("检查关键表 {table_name} 是否存在失败：{error}"))
    })?;

    if table_exists == 0 {
      missing_tables.push(table_name.to_string());
      continue;
    }

    // 这里用固定白名单表名拼 SQL，只为了确认“账号确实能读到这些表”。
    // 不引入动态用户输入，因此不会扩大 SQL 注入面。
    let readability_probe = format!("SELECT 1 FROM {table_name} LIMIT 1");
    sqlx::query(&readability_probe)
      .fetch_optional(pool)
      .await
      .map_err(|error| AppError::internal(format!("读取关键表 {table_name} 失败：{error}")))?;
    verified_tables.push(table_name.to_string());
  }

  if !missing_tables.is_empty() {
    return Err(AppError::invalid_config(format!(
      "suda_union 缺少关键表：{}",
      missing_tables.join(", ")
    )));
  }

  Ok(StartupCheckReport {
    database_name,
    verified_tables,
  })
}
