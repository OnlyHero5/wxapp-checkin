use serde::Serialize;

/// 兼容前端当前的业务错误 envelope。
/// 字段名继续固定成 snake_case，避免 Rust 端切换后前端判错逻辑失效。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ErrorResponse {
  pub status: String,
  pub message: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error_code: Option<String>,
}

impl ErrorResponse {
  pub fn new(status: impl Into<String>, message: impl Into<String>, error_code: Option<String>) -> Self {
    Self {
      status: status.into(),
      message: message.into(),
      error_code,
    }
  }
}

#[cfg(test)]
mod tests {
  use super::ErrorResponse;
  use serde_json::json;

  #[test]
  fn api_error_response_serializes_snake_case_envelope() {
    let response = ErrorResponse::new(
      "forbidden",
      "会话失效，请重新登录",
      Some("session_expired".to_string()),
    );

    let value = serde_json::to_value(response).expect("serialize error response");

    assert_eq!(
      value,
      json!({
        "status": "forbidden",
        "message": "会话失效，请重新登录",
        "error_code": "session_expired"
      })
    );
  }
}
