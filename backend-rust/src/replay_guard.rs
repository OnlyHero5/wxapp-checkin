use crate::error::AppError;
use moka::sync::Cache;
use std::time::Duration;

/// replay guard 只做单实例内短 TTL 防重。
/// 目标不是永久幂等，而是阻止同一窗口内的重复点按/脚本重复提交。
/// 这里改成 `moka` 的 TTL cache：
/// - TTL 淘汰不再手写；
/// - 并发插入语义由库负责；
/// - service 层只关心“第一次通过、重复拒绝”。
#[derive(Debug)]
pub struct ReplayGuard {
  entries: Cache<String, u64>,
}

impl ReplayGuard {
  pub fn new(ttl: Duration) -> Self {
    Self {
      entries: Cache::builder()
        .max_capacity(20_000)
        .time_to_live(ttl)
        .build(),
    }
  }

  pub fn acquire(&self, key: &str, now_ms: u64) -> Result<(), AppError> {
    let entry = self.entries.entry_by_ref(key).or_insert(now_ms);
    if !entry.is_fresh() {
      return Err(AppError::business(
        "duplicate",
        "当前时段已提交，请勿重复操作",
        None,
      ));
    }
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::ReplayGuard;
  use std::time::Duration;

  #[test]
  fn guard_should_reject_duplicate_submission_in_same_window() {
    let guard = ReplayGuard::new(Duration::from_secs(90));

    assert!(guard.acquire("u:7:legacy_act_101:checkin:1", 100).is_ok());
    let error = guard
      .acquire("u:7:legacy_act_101:checkin:1", 100)
      .expect_err("same key should be rejected");

    assert_eq!(error.status(), "duplicate");
  }
}
