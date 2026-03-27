use crate::domain::AttendanceActionType;
use serde::{Deserialize, Serialize};

/// 活动域的 HTTP 契约统一收在这里：
/// - handler 文件只负责路由与转发；
/// - service 继续直接复用这些响应 DTO；
/// - 请求边界的强类型约束也集中在这一层维护。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityListQuery {
  pub page: Option<i64>,
  pub page_size: Option<i64>,
  pub keyword: Option<String>,
}

/// 动态码签发查询参数只有一个稳定动作字段。
/// 这里直接改成枚举，避免把任意字符串放进业务层再二次判断。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeSessionQuery {
  pub action_type: AttendanceActionType,
}

/// 普通用户验码写路径也沿用同一动作枚举。
/// 这样签发与消费两端共享同一组 wire format 约束。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeConsumeRequest {
  pub action_type: AttendanceActionType,
  pub code: String,
}

/// 列表摘要 DTO 继续对齐 Web 前端当前基线。
/// 这里不夹杂派生逻辑，只负责锁定字段形状。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivitySummaryItem {
  pub activity_id: String,
  pub activity_title: String,
  pub activity_type: String,
  pub start_time: String,
  pub location: String,
  pub description: String,
  pub progress_status: String,
  pub support_checkout: bool,
  pub support_checkin: bool,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
  pub my_registered: bool,
  pub my_checked_in: bool,
  pub my_checked_out: bool,
}

/// 活动列表响应继续保持 envelope + 分页字段。
/// service 只需要填值，不再关心 HTTP 反序列化边界。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityListResponse {
  pub status: String,
  pub message: String,
  pub activities: Vec<ActivitySummaryItem>,
  pub page: i64,
  pub page_size: i64,
  pub has_more: bool,
  pub server_time_ms: u64,
}

/// 详情响应比列表多出“当前用户可执行性”和个人时间字段。
/// 把完整合同放到单独文件，避免 handler 与 DTO 混写继续膨胀。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityDetailResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub activity_title: String,
  pub activity_type: String,
  pub start_time: String,
  pub location: String,
  pub description: String,
  pub progress_status: String,
  pub support_checkout: bool,
  pub support_checkin: bool,
  pub has_detail: bool,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
  pub my_registered: bool,
  pub my_checked_in: bool,
  pub my_checked_out: bool,
  pub my_checkin_time: String,
  pub my_checkout_time: String,
  pub can_checkin: bool,
  pub can_checkout: bool,
  pub server_time_ms: u64,
}

/// staff 动态码页依赖的合同字段集中在这里。
/// `action_type` 直接用枚举序列化，保持 JSON 仍然是 `checkin/checkout`。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeSessionResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub action_type: AttendanceActionType,
  pub code: String,
  pub expires_at: u64,
  pub expires_in_ms: u64,
  pub server_time_ms: u64,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
}

/// 普通用户提交签到/签退后的结果合同。
/// 继续只暴露页面真正要显示和追踪的最小字段。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeConsumeResponse {
  pub status: String,
  pub message: String,
  pub action_type: AttendanceActionType,
  pub activity_id: String,
  pub activity_title: String,
  pub record_id: String,
  pub server_time_ms: u64,
}

#[cfg(test)]
mod tests {
  use crate::domain::AttendanceActionType;

  use super::CodeConsumeRequest;
  use super::CodeSessionQuery;

  // 这组测试只锁“HTTP 契约边界”：
  // 非法 action_type 必须在反序列化阶段就被挡住，而不是流进 service。
  #[test]
  fn code_session_query_should_reject_unknown_action_type() {
    let result = serde_json::from_str::<CodeSessionQuery>(r#"{"action_type":"rotate"}"#);

    assert!(result.is_err());
  }

  // 合法值仍要保持当前 JSON 线协议不变，避免前端 DTO 跟着漂移。
  #[test]
  fn code_consume_request_should_keep_known_action_type_as_typed_value() {
    let request =
      serde_json::from_str::<CodeConsumeRequest>(r#"{"action_type":"checkin","code":"123456"}"#)
        .expect("request");

    assert_eq!(request.action_type, AttendanceActionType::Checkin);
  }
}
