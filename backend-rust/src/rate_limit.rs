use crate::error::AppError;
use governor::DefaultKeyedRateLimiter;
use governor::Quota;
use governor::RateLimiter;
use std::num::NonZeroU32;
use std::time::Duration;

/// 错误次数限流同样只做单实例内存窗口计数。
/// 这里不再自己维护窗口 HashMap，而是直接复用 governor：
/// - 仍然保持“进程内、无 Redis”的低依赖口径；
/// - 令牌桶算法和并发安全由成熟库负责；
/// - 业务层只保留 key 设计与错误映射。
#[derive(Debug)]
pub struct InvalidCodeAttemptLimiter {
  window: Duration,
  limiter: Option<DefaultKeyedRateLimiter<String>>,
}

impl InvalidCodeAttemptLimiter {
  pub fn new(max_attempts_per_user: u32, window: Duration) -> Self {
    let limiter = NonZeroU32::new(max_attempts_per_user).and_then(|max_attempts| {
      window
        .checked_div(max_attempts_per_user)
        .and_then(Quota::with_period)
        .map(|quota| RateLimiter::keyed(quota.allow_burst(max_attempts)))
    });
    Self { window, limiter }
  }

  pub fn record_invalid_attempt_or_throw(
    &self,
    user_id: i64,
    activity_id: &str,
    _now_ms: u64,
  ) -> Result<(), AppError> {
    let Some(limiter) = &self.limiter else {
      return Ok(());
    };

    let key = format!("u:{user_id}:{}", activity_id.trim());
    if limiter.check_key(&key).is_err() {
      return Err(AppError::business(
        "forbidden",
        format!(
          "验证码尝试次数过多，请稍后再试（{} 秒后重试）",
          self.window.as_secs()
        ),
        Some("rate_limited"),
      ));
    }
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::InvalidCodeAttemptLimiter;
  use std::time::Duration;

  #[test]
  fn limiter_should_reject_after_exceeding_burst_budget() {
    let limiter = InvalidCodeAttemptLimiter::new(2, Duration::from_secs(60));

    assert!(
      limiter
        .record_invalid_attempt_or_throw(7, "legacy_act_101", 0)
        .is_ok()
    );
    assert!(
      limiter
        .record_invalid_attempt_or_throw(7, "legacy_act_101", 0)
        .is_ok()
    );
    let error = limiter
      .record_invalid_attempt_or_throw(7, "legacy_act_101", 0)
      .expect_err("third invalid attempt should be rejected");

    assert_eq!(error.error_code(), Some("rate_limited"));
  }
}
