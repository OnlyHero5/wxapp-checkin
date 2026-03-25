use crate::api::error_response::ErrorResponse;
use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use std::error::Error;
use std::fmt::{Display, Formatter};

/// 当前阶段先把错误分成“配置错误”和“服务内部错误”两类。
/// 后续接业务接口时，再继续补 session_expired / invalid_password 等兼容错误码。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppError {
  status: &'static str,
  message: String,
  error_code: Option<String>,
}

impl AppError {
  pub fn status(&self) -> &'static str {
    self.status
  }

  pub fn message(&self) -> &str {
    &self.message
  }

  pub fn error_code(&self) -> Option<&str> {
    self.error_code.as_deref()
  }

  pub fn business(
    status: &'static str,
    message: impl Into<String>,
    error_code: Option<&str>,
  ) -> Self {
    Self {
      status,
      message: message.into(),
      error_code: error_code.map(ToOwned::to_owned),
    }
  }

  pub fn invalid_config(message: impl Into<String>) -> Self {
    Self::business("error", message, Some("invalid_config"))
  }

  pub fn internal(message: impl Into<String>) -> Self {
    Self::business("error", message, Some("internal_error"))
  }
}

impl Display for AppError {
  fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
    match &self.error_code {
      Some(error_code) => write!(f, "{} ({error_code})", self.message),
      None => write!(f, "{}", self.message),
    }
  }
}

impl Error for AppError {}

impl IntoResponse for AppError {
  fn into_response(self) -> Response {
    let body = ErrorResponse::new(self.status, self.message, self.error_code);

    // 这里先继续沿用“HTTP 200 + JSON envelope”的前端兼容模式，
    // 避免新服务刚切入时把现有 requestJson 错误分支全部打乱。
    (StatusCode::OK, Json(body)).into_response()
  }
}
