use crate::error::AppError;
use jsonwebtoken::Algorithm;
use jsonwebtoken::DecodingKey;
use jsonwebtoken::EncodingKey;
use jsonwebtoken::Header;
use jsonwebtoken::Validation;
use jsonwebtoken::decode;
use jsonwebtoken::encode;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// 会话 token 不引入完整 JWT 生态，原因有两个：
/// 1. 当前 claims 很小，仍然可以把载荷控制在极低体积；
/// 2. 但协议打包、签名和解码校验不该继续手写，应交给成熟库维护。
#[derive(Debug, Clone)]
pub struct SessionTokenSigner {
  encoding_key: EncodingKey,
  decoding_key: DecodingKey,
  validation: Validation,
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
    let secret = secret.as_ref().to_vec();
    // 这里显式关闭库内的过期时间判断：
    // - 现有接口需要注入 `now` 以便测试和业务层显式控制时间；
    // - 签名、结构校验仍由 jsonwebtoken 承担；
    // - 过期判断继续由当前模块统一映射成现有业务错误码。
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = false;
    Self {
      encoding_key: EncodingKey::from_secret(&secret),
      decoding_key: DecodingKey::from_secret(&secret),
      validation,
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
    // header/claims 的序列化、base64url 封装与 HS256 签名都交给库层完成，
    // 这样后续不会再由业务代码维护 JWT 细节。
    encode(&Header::new(Algorithm::HS256), &claims, &self.encoding_key)
      .map_err(|error| AppError::internal(format!("生成 session token 失败：{error}")))
  }

  pub fn verify(&self, token: &str, now: SystemTime) -> Result<SessionTokenClaims, AppError> {
    let claims = decode::<SessionTokenClaims>(token.trim(), &self.decoding_key, &self.validation)
      .map_err(|_| session_expired_error())?
      .claims;
    let now_seconds = unix_seconds(now)?;
    if now_seconds > claims.exp {
      return Err(session_expired_error());
    }
    Ok(claims)
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
