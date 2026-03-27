use crate::domain::AttendanceAdjustmentCommand;
use crate::error::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AttendanceAdjustmentRequest {
  pub user_ids: Vec<i64>,
  pub patch: AttendanceAdjustmentPatch,
  pub reason: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AttendanceAdjustmentPatch {
  pub checked_in: Option<bool>,
  pub checked_out: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BulkCheckoutRequest {
  pub confirm: bool,
  pub reason: String,
}

/// 路由层传给 service 的 staff 名单修正输入。
/// 这里已经完成 user_ids、patch 与 reason 的规范化，service 不再接原始 JSON 形状。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttendanceAdjustmentInput {
  pub user_ids: Vec<i64>,
  pub patch: AttendanceAdjustmentCommand,
  pub reason: String,
}

/// 批量签退现在也在入口处完成确认与原因文案规范化。
/// service 只接收“已经确认且 reason 合法”的输入。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BulkCheckoutInput {
  pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityRosterItem {
  pub user_id: i64,
  pub student_id: String,
  pub name: String,
  pub checked_in: bool,
  pub checked_out: bool,
  pub checkin_time: String,
  pub checkout_time: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ActivityRosterResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub activity_title: String,
  pub activity_type: String,
  pub start_time: String,
  pub location: String,
  pub description: String,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
  pub items: Vec<ActivityRosterItem>,
  pub server_time_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AttendanceAdjustmentResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub affected_count: i64,
  pub batch_id: String,
  pub server_time_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct BulkCheckoutResponse {
  pub status: String,
  pub message: String,
  pub activity_id: String,
  pub affected_count: i64,
  pub batch_id: String,
  pub server_time_ms: u64,
}

impl AttendanceAdjustmentPatch {
  fn into_command(self) -> Result<AttendanceAdjustmentCommand, AppError> {
    /*
     * Web 前端当前只会发四种单一命令。
     * 这里在 API 边界就收口，避免 service 再解释“两个布尔位同时出现时到底算什么”。
     */
    match (self.checked_in, self.checked_out) {
      (Some(true), None) => Ok(AttendanceAdjustmentCommand::SetCheckedIn),
      (Some(false), None) => Ok(AttendanceAdjustmentCommand::ClearCheckedIn),
      (None, Some(true)) => Ok(AttendanceAdjustmentCommand::SetCheckedOut),
      (None, Some(false)) => Ok(AttendanceAdjustmentCommand::ClearCheckedOut),
      _ => Err(AppError::business("invalid_param", "patch 组合非法", None)),
    }
  }
}

impl AttendanceAdjustmentRequest {
  pub fn into_input(self) -> Result<AttendanceAdjustmentInput, AppError> {
    Ok(AttendanceAdjustmentInput {
      user_ids: normalize_user_ids(&self.user_ids)?,
      patch: self.patch.into_command()?,
      reason: normalize_reason(&self.reason)?,
    })
  }
}

impl BulkCheckoutRequest {
  pub fn into_input(self) -> Result<BulkCheckoutInput, AppError> {
    if !self.confirm {
      return Err(AppError::business(
        "invalid_param",
        "批量签退必须显式确认",
        None,
      ));
    }

    Ok(BulkCheckoutInput {
      reason: normalize_reason(&self.reason)?,
    })
  }
}

fn normalize_user_ids(user_ids: &[i64]) -> Result<Vec<i64>, AppError> {
  if user_ids.is_empty() {
    return Err(AppError::business(
      "invalid_param",
      "user_ids 不能为空",
      None,
    ));
  }

  let mut normalized = user_ids
    .iter()
    .copied()
    .filter(|user_id| *user_id > 0)
    .collect::<Vec<_>>();
  normalized.sort_unstable();
  normalized.dedup();

  if normalized.is_empty() {
    return Err(AppError::business(
      "invalid_param",
      "user_ids 必须全部是正整数",
      None,
    ));
  }

  Ok(normalized)
}

fn normalize_reason(reason: &str) -> Result<String, AppError> {
  let normalized = reason.trim();
  if normalized.is_empty() {
    return Err(AppError::business(
      "invalid_param",
      "reason 不能为空",
      None,
    ));
  }
  Ok(normalized.to_string())
}

#[cfg(test)]
#[path = "staff_contracts_tests.rs"]
mod tests;
