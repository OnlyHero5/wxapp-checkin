use crate::error::AppError;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

#[derive(Debug)]
struct AttemptWindow {
  expires_at_ms: u64,
  count: u32,
}

/// 错误次数限流同样只做单实例内存窗口计数。
/// 这和旧 Java 基线一致：优先压低依赖和内存基线，不为第一阶段引入 Redis。
#[derive(Debug)]
pub struct InvalidCodeAttemptLimiter {
  max_attempts_per_user: u32,
  window: Duration,
  windows: Mutex<HashMap<String, AttemptWindow>>,
}

impl InvalidCodeAttemptLimiter {
  pub fn new(max_attempts_per_user: u32, window: Duration) -> Self {
    Self {
      max_attempts_per_user,
      window,
      windows: Mutex::new(HashMap::new()),
    }
  }

  pub fn record_invalid_attempt_or_throw(
    &self,
    user_id: i64,
    activity_id: &str,
    now_ms: u64,
  ) -> Result<(), AppError> {
    let key = format!("u:{user_id}:{}", activity_id.trim());
    let mut windows = self
      .windows
      .lock()
      .map_err(|_| AppError::internal("invalid-code limiter 已损坏"))?;
    windows.retain(|_, window| window.expires_at_ms > now_ms);

    let entry = windows.entry(key).or_insert(AttemptWindow {
      expires_at_ms: now_ms + self.window.as_millis() as u64,
      count: 0,
    });
    if entry.expires_at_ms <= now_ms {
      entry.expires_at_ms = now_ms + self.window.as_millis() as u64;
      entry.count = 0;
    }
    entry.count += 1;

    if self.max_attempts_per_user > 0 && entry.count > self.max_attempts_per_user {
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
