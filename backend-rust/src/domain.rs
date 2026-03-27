use crate::error::AppError;
use serde::{Deserialize, Serialize};

/// Rust 重写后仍然只暴露两种角色：
/// - `normal`
/// - `staff`
///
/// 底层 `suda_user.role` 可能更细，但前端当前只认这两个值。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WebRole {
  Normal,
  Staff,
}

impl WebRole {
  pub fn as_str(self) -> &'static str {
    match self {
      Self::Normal => "normal",
      Self::Staff => "staff",
    }
  }
}

/// 签到/签退动作是前后端共享的稳定业务词汇。
/// 这里把它收口成强类型，避免 API 边界把任意字符串继续放进 service。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttendanceActionType {
  Checkin,
  Checkout,
}

impl AttendanceActionType {
  pub fn as_str(self) -> &'static str {
    match self {
      Self::Checkin => "checkin",
      Self::Checkout => "checkout",
    }
  }
}

/// staff 名单修正只允许四种稳定命令。
/// 这层只表达“想把记录推到哪个状态”，具体是否需要保留旧 flag 由 apply 统一决策。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttendanceAdjustmentCommand {
  SetCheckedIn,
  ClearCheckedIn,
  SetCheckedOut,
  ClearCheckedOut,
}

impl AttendanceAdjustmentCommand {
  pub fn apply(self, current_check_in: i64, current_check_out: i64) -> (i64, i64) {
    match self {
      Self::SetCheckedIn => (1, 0),
      Self::ClearCheckedIn => (0, 0),
      Self::SetCheckedOut => (1, 1),
      Self::ClearCheckedOut => {
        if current_check_in == 0 && current_check_out == 0 {
          (0, 0)
        } else {
          (1, 0)
        }
      }
    }
  }
}

pub fn role_from_legacy(value: i32) -> WebRole {
  if (0..=3).contains(&value) {
    WebRole::Staff
  } else {
    WebRole::Normal
  }
}

pub fn permissions_for_role(role: WebRole) -> Vec<&'static str> {
  match role {
    WebRole::Normal => Vec::new(),
    WebRole::Staff => vec![
      "activity:checkin",
      "activity:checkout",
      "activity:detail",
      "activity:manage",
      "activity:bulk-checkout",
      "activity:roster",
      "activity:attendance-adjust",
    ],
  }
}

pub fn format_activity_id(legacy_activity_id: i64) -> String {
  format!("legacy_act_{legacy_activity_id}")
}

pub fn parse_activity_id(activity_id: &str) -> Result<i64, AppError> {
  let raw = activity_id.trim();
  let suffix = raw.strip_prefix("legacy_act_").ok_or_else(|| {
    AppError::business(
      "invalid_param",
      "activity_id 格式非法",
      Some("invalid_activity"),
    )
  })?;
  suffix.parse::<i64>().map_err(|_| {
    AppError::business(
      "invalid_param",
      "activity_id 格式非法",
      Some("invalid_activity"),
    )
  })
}

pub fn activity_type_from_legacy(value: i32) -> &'static str {
  if value == 1 { "讲座" } else { "活动" }
}

pub fn progress_status_from_legacy(value: i32) -> &'static str {
  if value >= 4 { "completed" } else { "ongoing" }
}

#[cfg(test)]
mod tests {
  use super::{
    AttendanceActionType, AttendanceAdjustmentCommand, WebRole, activity_type_from_legacy,
    format_activity_id, parse_activity_id, permissions_for_role, progress_status_from_legacy,
    role_from_legacy,
  };

  #[test]
  fn staff_role_should_match_legacy_low_codes() {
    assert_eq!(role_from_legacy(0), WebRole::Staff);
    assert_eq!(role_from_legacy(3), WebRole::Staff);
    assert_eq!(role_from_legacy(9), WebRole::Normal);
  }

  #[test]
  fn activity_id_should_round_trip() {
    let activity_id = format_activity_id(101);
    assert_eq!(activity_id, "legacy_act_101");
    assert_eq!(parse_activity_id(&activity_id).expect("parse"), 101);
  }

  #[test]
  fn staff_permissions_should_remain_stable() {
    let permissions = permissions_for_role(WebRole::Staff);
    assert!(permissions.contains(&"activity:manage"));
    assert!(permissions.contains(&"activity:attendance-adjust"));
  }

  #[test]
  fn attendance_action_type_should_keep_wire_format_stable() {
    assert_eq!(AttendanceActionType::Checkin.as_str(), "checkin");
    assert_eq!(AttendanceActionType::Checkout.as_str(), "checkout");
  }

  #[test]
  fn clear_checked_out_should_keep_unchecked_rows_unchanged() {
    assert_eq!(
      AttendanceAdjustmentCommand::ClearCheckedOut.apply(0, 0),
      (0, 0)
    );
    assert_eq!(
      AttendanceAdjustmentCommand::ClearCheckedOut.apply(1, 1),
      (1, 0)
    );
  }

  #[test]
  fn legacy_activity_flags_should_match_old_projection_rules() {
    assert_eq!(activity_type_from_legacy(1), "讲座");
    assert_eq!(activity_type_from_legacy(2), "活动");
    assert_eq!(progress_status_from_legacy(3), "ongoing");
    assert_eq!(progress_status_from_legacy(4), "completed");
  }
}
