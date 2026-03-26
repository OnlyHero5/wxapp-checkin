use crate::error::AppError;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

/// replay guard 只做单实例内短 TTL 防重。
/// 目标不是永久幂等，而是阻止同一窗口内的重复点按/脚本重复提交。
#[derive(Debug)]
pub struct ReplayGuard {
  ttl: Duration,
  entries: Mutex<HashMap<String, u64>>,
}

impl ReplayGuard {
  pub fn new(ttl: Duration) -> Self {
    Self {
      ttl,
      entries: Mutex::new(HashMap::new()),
    }
  }

  pub fn acquire(&self, key: &str, now_ms: u64) -> Result<(), AppError> {
    let mut entries = self
      .entries
      .lock()
      .map_err(|_| AppError::internal("replay guard 已损坏"))?;
    entries.retain(|_, expires_at| *expires_at > now_ms);
    if entries.get(key).copied().unwrap_or(0) > now_ms {
      return Err(AppError::business(
        "duplicate",
        "当前时段已提交，请勿重复操作",
        None,
      ));
    }
    entries.insert(key.to_string(), now_ms + self.ttl.as_millis() as u64);
    Ok(())
  }
}
