use crate::error::AppError;

const DEFAULT_PASSWORD: &str = "123";

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

/// 默认密码是否仍未修改，直接影响 `must_change_password`。
/// 若 hash 为空或损坏，也按“仍需改密”处理，避免脏数据绕过安全护栏。
pub fn must_change_password(password_hash: Option<&str>) -> bool {
  match password_hash.map(str::trim) {
    Some(value) if !value.is_empty() => bcrypt::verify(DEFAULT_PASSWORD, value).unwrap_or(true),
    _ => true,
  }
}

pub fn format_activity_id(legacy_activity_id: i64) -> String {
  format!("legacy_act_{legacy_activity_id}")
}

pub fn parse_activity_id(activity_id: &str) -> Result<i64, AppError> {
  let raw = activity_id.trim();
  let suffix = raw
    .strip_prefix("legacy_act_")
    .ok_or_else(|| AppError::business("invalid_param", "activity_id 格式非法", Some("invalid_activity")))?;
  suffix
    .parse::<i64>()
    .map_err(|_| AppError::business("invalid_param", "activity_id 格式非法", Some("invalid_activity")))
}

pub fn activity_type_from_legacy(value: i32) -> &'static str {
  if value == 1 {
    "讲座"
  } else {
    "活动"
  }
}

pub fn progress_status_from_legacy(value: i32) -> &'static str {
  if value >= 4 {
    "completed"
  } else {
    "ongoing"
  }
}

#[cfg(test)]
mod tests {
  use super::{
    WebRole, activity_type_from_legacy, format_activity_id, must_change_password, parse_activity_id,
    permissions_for_role, progress_status_from_legacy, role_from_legacy,
  };

  #[test]
  fn staff_role_should_match_legacy_low_codes() {
    assert_eq!(role_from_legacy(0), WebRole::Staff);
    assert_eq!(role_from_legacy(3), WebRole::Staff);
    assert_eq!(role_from_legacy(9), WebRole::Normal);
  }

  #[test]
  fn default_password_hash_should_require_change() {
    let hash = bcrypt::hash("123", bcrypt::DEFAULT_COST).expect("hash");
    assert!(must_change_password(Some(&hash)));
  }

  #[test]
  fn changed_password_hash_should_not_require_change() {
    let hash = bcrypt::hash("new-pass", bcrypt::DEFAULT_COST).expect("hash");
    assert!(!must_change_password(Some(&hash)));
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
  fn legacy_activity_flags_should_match_old_projection_rules() {
    assert_eq!(activity_type_from_legacy(1), "讲座");
    assert_eq!(activity_type_from_legacy(2), "活动");
    assert_eq!(progress_status_from_legacy(3), "ongoing");
    assert_eq!(progress_status_from_legacy(4), "completed");
  }
}
