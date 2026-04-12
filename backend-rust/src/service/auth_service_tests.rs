use super::{build_current_user, ensure_account_active};
use crate::domain::WebRole;

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
