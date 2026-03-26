use crate::config::Config;
use crate::db;
use crate::error::AppError;
use crate::rate_limit::InvalidCodeAttemptLimiter;
use crate::replay_guard::ReplayGuard;
use crate::token::SessionTokenSigner;
use sqlx::MySqlPool;
use std::sync::Arc;
use std::time::Duration;

/// 统一状态容器现在先只承载配置。
/// 等后续接入 sqlx 连接池和进程内 TTL guard 时，也继续沿用同一入口扩展。
#[derive(Debug, Clone)]
pub struct AppState {
  shared: Arc<SharedState>,
}

#[derive(Debug)]
struct SharedState {
  config: Config,
  pool: MySqlPool,
  session_token_signer: SessionTokenSigner,
  replay_guard: ReplayGuard,
  invalid_code_limiter: InvalidCodeAttemptLimiter,
}

impl AppState {
  pub fn new(config: Config) -> Result<Self, AppError> {
    let pool = db::connect_pool(&config)?;
    // 现阶段先复用 `QR_SIGNING_KEY` 派生会话签名能力：
    // - 避免在第一阶段再引入新的密钥配置面；
    // - 后续若要拆分 session / code secret，再在配置层显式扩字段。
    let session_token_signer =
      SessionTokenSigner::new(config.qr_signing_key.as_bytes(), config.session_ttl_seconds);
    Ok(Self {
      shared: Arc::new(SharedState {
        config,
        pool,
        session_token_signer,
        replay_guard: ReplayGuard::new(Duration::from_secs(90)),
        invalid_code_limiter: InvalidCodeAttemptLimiter::new(12, Duration::from_secs(60)),
      }),
    })
  }

  pub fn config(&self) -> &Config {
    &self.shared.config
  }

  pub fn pool(&self) -> &MySqlPool {
    &self.shared.pool
  }

  pub fn session_token_signer(&self) -> &SessionTokenSigner {
    &self.shared.session_token_signer
  }

  pub fn replay_guard(&self) -> &ReplayGuard {
    &self.shared.replay_guard
  }

  pub fn invalid_code_limiter(&self) -> &InvalidCodeAttemptLimiter {
    &self.shared.invalid_code_limiter
  }
}
