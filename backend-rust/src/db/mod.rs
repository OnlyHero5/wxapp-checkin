pub mod activity_repo;
pub mod attendance_repo;
pub mod log_repo;
pub mod user_repo;

use crate::config::Config;
use crate::error::AppError;
use sqlx::MySqlPool;
use sqlx::mysql::MySqlPoolOptions;
use std::time::Duration;

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
