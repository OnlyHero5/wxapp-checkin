use crate::api::auth_extractor::CurrentUser;
use crate::domain::WebRole;
use crate::error::AppError;
use std::time::{SystemTime, UNIX_EPOCH};

/// 这里收口跨 service 复用、但又不属于单个业务域的轻量辅助逻辑：
/// - 当前用户角色映射
/// - 毫秒级服务端时间
///
/// 这些逻辑本身不复杂，但如果散落在多个 service 文件里反复手写，
/// 很快就会变成“每个模块都有一小段一样代码”的维护负担。
pub(crate) fn role_from_user(current_user: &CurrentUser) -> WebRole {
  if current_user.role == "staff" {
    WebRole::Staff
  } else {
    WebRole::Normal
  }
}

/// 多条读写链路都会把当前毫秒时间写入响应、日志或批次号。
/// 统一收口后：
/// 1. 时间异常时的错误语义只维护一处；
/// 2. service 文件只保留业务编排；
/// 3. 后续若要替换时间来源，也不必分散修改。
pub(crate) fn now_millis() -> Result<u64, AppError> {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH"))
}

#[cfg(test)]
mod tests {
  use super::now_millis;
  use super::role_from_user;
  use crate::api::auth_extractor::CurrentUser;
  use crate::domain::WebRole;

  fn sample_user(role: &str) -> CurrentUser {
    CurrentUser {
      user_id: 7,
      student_id: "2025000007".to_string(),
      name: "刘洋".to_string(),
      role: role.to_string(),
      permissions: Vec::new(),
      department: "团委".to_string(),
      club: String::new(),
    }
  }

  #[test]
  fn role_mapping_should_only_treat_staff_string_as_staff() {
    assert_eq!(role_from_user(&sample_user("staff")), WebRole::Staff);
    assert_eq!(role_from_user(&sample_user("normal")), WebRole::Normal);
  }

  #[test]
  fn now_millis_should_return_a_positive_unix_timestamp() {
    assert!(now_millis().expect("unix millis") > 0);
  }
}
