use super::{build_current_user, ensure_account_active, should_record_login_failure_audit};
use crate::domain::WebRole;
use crate::error::AppError;

#[test]
fn current_user_should_inherit_staff_permissions() {
  let current_user = build_current_user(
    7,
    "2025000007".to_string(),
    "刘洋".to_string(),
    WebRole::Staff,
    "学生会".to_string(),
  );

  assert_eq!(current_user.role, "staff");
  assert!(
    current_user
      .permissions
      .contains(&"activity:manage".to_string())
  );
}

#[test]
fn disabled_account_should_be_rejected() {
  let error = ensure_account_active(Some(1)).expect_err("invalid=1 should be rejected");

  assert_eq!(error.status(), "forbidden");
  assert_eq!(error.error_code(), Some("account_disabled"));
}

#[test]
fn rate_limited_failures_should_not_append_login_audit_rows() {
  let error = AppError::business("forbidden", "登录失败次数过多", Some("rate_limited"));

  assert!(!should_record_login_failure_audit(&error));
}

#[test]
fn invalid_credential_failures_should_still_be_audited() {
  let error = AppError::business("forbidden", "账号或密码错误", Some("invalid_credentials"));

  assert!(should_record_login_failure_audit(&error));
}
