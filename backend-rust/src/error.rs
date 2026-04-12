use crate::api::error_response::ErrorResponse;
use crate::terminal_banner;
use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use std::error::Error;
use std::fmt::{Display, Formatter};

/// 当前错误模型继续保留旧有 JSON envelope 字段，
/// 但不再把所有失败都伪装成 HTTP 200。
///
/// 这样改动后的收益是：
/// 1. 现有前端仍可继续读取 `status/message/error_code`；
/// 2. 反向代理、日志和调试工具能直接看懂真实 HTTP 语义；
/// 3. 后续如果接中间件、监控或 API 网关，也不会被“全 200”误导。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppError {
  status: &'static str,
  http_status: StatusCode,
  message: String,
  error_code: Option<String>,
  detail: Option<String>,
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

  /**
   * 业务错误继续只暴露旧接口签名，避免调用方大面积跟着改。
   *
   * HTTP 状态码由这一层统一推导：
   * - 业务模块继续表达“业务状态”；
   * - 框架边界负责把它映射成标准 HTTP 语义。
   */
  pub fn business(
    status: &'static str,
    message: impl Into<String>,
    error_code: Option<&str>,
  ) -> Self {
    Self {
      status,
      http_status: resolve_http_status(status, error_code),
      message: message.into(),
      error_code: error_code.map(ToOwned::to_owned),
      detail: None,
    }
  }

  pub fn invalid_config(message: impl Into<String>) -> Self {
    Self::business("error", message, Some("invalid_config"))
  }

  pub fn internal(message: impl Into<String>) -> Self {
    Self {
      status: "error",
      http_status: StatusCode::INTERNAL_SERVER_ERROR,
      message: "系统内部错误，请稍后重试".to_string(),
      error_code: Some("internal_error".to_string()),
      detail: Some(message.into()),
    }
  }
}

impl Display for AppError {
  fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
    let rendered_message = self.detail.as_deref().unwrap_or(&self.message);
    match &self.error_code {
      Some(error_code) => write!(f, "{rendered_message} ({error_code})"),
      None => write!(f, "{rendered_message}"),
    }
  }
}

impl Error for AppError {}

impl IntoResponse for AppError {
  fn into_response(self) -> Response {
    // API 错误继续返回现有 envelope，同时在容器终端补一条稳定日志。
    // 这样前端契约、运维排查和 HTTP 语义三者可以同时成立。
    let error_code = self.error_code.clone();
    let log_message = self.detail.clone().unwrap_or_else(|| self.message.clone());
    terminal_banner::print_error(
      "接口请求失败",
      match error_code.as_deref() {
        Some(code) => format!("{code}: {log_message}"),
        None => log_message,
      },
    );
    let body = ErrorResponse::new(self.status, self.message, self.error_code);

    (self.http_status, Json(body)).into_response()
  }
}

fn resolve_http_status(status: &str, error_code: Option<&str>) -> StatusCode {
  match (status, error_code) {
    ("duplicate", _) => StatusCode::CONFLICT,
    ("expired", _) => StatusCode::GONE,
    ("forbidden", Some("rate_limited")) => StatusCode::TOO_MANY_REQUESTS,
    ("forbidden", _) => StatusCode::FORBIDDEN,
    ("invalid_param", _) => StatusCode::BAD_REQUEST,
    ("invalid_activity", _) => StatusCode::NOT_FOUND,
    ("error", _) => StatusCode::INTERNAL_SERVER_ERROR,
    _ => StatusCode::BAD_REQUEST,
  }
}
