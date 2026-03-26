use crate::error::AppError;
use std::env;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

const DEFAULT_SERVER_PORT: u16 = 8080;
const DEFAULT_SESSION_TTL_SECONDS: u64 = 7_200;
const DEFAULT_TOKIO_WORKER_THREADS: usize = 2;
const DEFAULT_MYSQL_MAX_CONNECTIONS: u32 = 4;

/// 运行期配置只保留 Rust 基线现在就需要的最小集合。
/// 后续即使继续扩字段，也要优先遵守“小连接池、低线程数、低常驻内存”的约束。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
  pub database_url: String,
  pub server_port: u16,
  pub session_ttl_seconds: u64,
  pub qr_signing_key: String,
  pub tokio_worker_threads: usize,
  pub mysql_max_connections: u32,
}

impl Config {
  pub fn from_env() -> Result<Self, AppError> {
    Ok(Self {
      database_url: required_env("DATABASE_URL")?,
      server_port: optional_env("SERVER_PORT", DEFAULT_SERVER_PORT)?,
      session_ttl_seconds: optional_env("SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL_SECONDS)?,
      qr_signing_key: required_env("QR_SIGNING_KEY")?,
      tokio_worker_threads: optional_env("TOKIO_WORKER_THREADS", DEFAULT_TOKIO_WORKER_THREADS)?,
      mysql_max_connections: optional_env("MYSQL_MAX_CONNECTIONS", DEFAULT_MYSQL_MAX_CONNECTIONS)?,
    })
  }

  pub fn bind_address(&self) -> SocketAddr {
    SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), self.server_port)
  }
}

fn required_env(key: &str) -> Result<String, AppError> {
  match env::var(key) {
    Ok(value) if !value.trim().is_empty() => Ok(value),
    Ok(_) | Err(_) => Err(AppError::invalid_config(format!("缺少环境变量：{key}"))),
  }
}

fn optional_env<T>(key: &str, default: T) -> Result<T, AppError>
where
  T: std::str::FromStr,
{
  match env::var(key) {
    Ok(raw) if !raw.trim().is_empty() => raw
      .trim()
      .parse::<T>()
      .map_err(|_| AppError::invalid_config(format!("环境变量 {key} 格式不合法"))),
    Ok(_) | Err(_) => Ok(default),
  }
}

#[cfg(test)]
mod tests {
  use super::Config;
  use std::env;
  use std::sync::{Mutex, OnceLock};

  fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
  }

  #[test]
  fn uses_low_memory_defaults_when_optional_envs_missing() {
    let _guard = env_lock().lock().expect("env lock");
    // Rust 2024 把环境变量写操作标成 unsafe；
    // 这里已经用全局互斥锁串行化测试，避免并发读写同一进程环境带来的未定义行为。
    unsafe {
      env::set_var(
        "DATABASE_URL",
        "mysql://root:root@127.0.0.1:3306/suda_union",
      );
      env::set_var("QR_SIGNING_KEY", "test-secret");
      env::remove_var("SERVER_PORT");
      env::remove_var("SESSION_TTL_SECONDS");
      env::remove_var("TOKIO_WORKER_THREADS");
      env::remove_var("MYSQL_MAX_CONNECTIONS");
    }

    let config = Config::from_env().expect("config");

    assert_eq!(config.server_port, 8080);
    assert_eq!(config.session_ttl_seconds, 7_200);
    assert_eq!(config.tokio_worker_threads, 2);
    assert_eq!(config.mysql_max_connections, 4);
  }
}
