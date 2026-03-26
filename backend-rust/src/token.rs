use crate::error::AppError;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

/// 会话 token 不引入完整 JWT 生态，原因有两个：
/// 1. 当前只需要极小的 claims 集合；
/// 2. 目标是继续压低依赖和运行时负担，而不是追求协议花样。
#[derive(Debug, Clone)]
pub struct SessionTokenSigner {
  secret: Vec<u8>,
  ttl_seconds: u64,
}

/// claims 只保留当前鉴权层真正会用到的最小字段。
/// 角色和学号虽然会在鉴权后再次回查数据库刷新，但保留在 token 里便于快速做一致性核对。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionTokenClaims {
  pub uid: i64,
  pub student_id: String,
  pub role: String,
  pub exp: u64,
  pub iat: u64,
}

impl SessionTokenSigner {
  pub fn new(secret: impl AsRef<[u8]>, ttl_seconds: u64) -> Self {
    Self {
      secret: secret.as_ref().to_vec(),
      ttl_seconds,
    }
  }

  pub fn issue(
    &self,
    uid: i64,
    student_id: &str,
    role: &str,
    issued_at: SystemTime,
  ) -> Result<String, AppError> {
    let iat = unix_seconds(issued_at)?;
    let claims = SessionTokenClaims {
      uid,
      student_id: student_id.trim().to_string(),
      role: role.trim().to_string(),
      exp: iat.saturating_add(self.ttl_seconds),
      iat,
    };
    let payload = serde_json::to_vec(&claims)
      .map_err(|error| AppError::internal(format!("序列化 session token 失败：{error}")))?;
    let encoded_payload = URL_SAFE_NO_PAD.encode(payload);
    let signature = self.sign(encoded_payload.as_bytes())?;
    Ok(format!(
      "{encoded_payload}.{}",
      URL_SAFE_NO_PAD.encode(signature)
    ))
  }

  pub fn verify(&self, token: &str, now: SystemTime) -> Result<SessionTokenClaims, AppError> {
    let (payload_part, signature_part) = token
      .trim()
      .split_once('.')
      .ok_or_else(session_expired_error)?;
    let provided_signature = URL_SAFE_NO_PAD
      .decode(signature_part)
      .map_err(|_| session_expired_error())?;
    self.verify_signature(payload_part.as_bytes(), &provided_signature)?;

    let payload = URL_SAFE_NO_PAD
      .decode(payload_part)
      .map_err(|_| session_expired_error())?;
    let claims: SessionTokenClaims =
      serde_json::from_slice(&payload).map_err(|_| session_expired_error())?;
    let now_seconds = unix_seconds(now)?;
    if now_seconds > claims.exp {
      return Err(session_expired_error());
    }
    Ok(claims)
  }

  // 这里显式走 HMAC 库自带的验签接口，而不是自己比较字节数组。
  // 这样后续即使摘要实现变更，也仍然由库层统一维护验签语义。
  fn verify_signature(&self, payload: &[u8], signature: &[u8]) -> Result<(), AppError> {
    let mut mac = HmacSha256::new_from_slice(&self.secret)
      .map_err(|error| AppError::internal(format!("初始化 session token 签名器失败：{error}")))?;
    mac.update(payload);
    mac
      .verify_slice(signature)
      .map_err(|_| session_expired_error())
  }

  fn sign(&self, payload: &[u8]) -> Result<Vec<u8>, AppError> {
    let mut mac = HmacSha256::new_from_slice(&self.secret)
      .map_err(|error| AppError::internal(format!("初始化 session token 签名器失败：{error}")))?;
    mac.update(payload);
    Ok(mac.finalize().into_bytes().to_vec())
  }
}

fn unix_seconds(value: SystemTime) -> Result<u64, AppError> {
  value
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_secs())
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH，无法生成 token"))
}

fn session_expired_error() -> AppError {
  AppError::business("forbidden", "会话失效，请重新登录", Some("session_expired"))
}
