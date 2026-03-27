use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::activity_repo;
use crate::error::AppError;

/// staff 路径的权限入口统一收敛在这里。
/// 这样 roster、名单修正和批量签退共享同一角色判断，不会各自漂移。
pub(super) fn require_staff(current_user: &CurrentUser) -> Result<(), AppError> {
  if current_user.role == "staff" {
    Ok(())
  } else {
    Err(AppError::business(
      "forbidden",
      "仅工作人员可查看或修正参会名单",
      None,
    ))
  }
}

/// staff 相关写读接口都依赖活动存在性，因此提供统一的活动装载入口。
/// 这样缺失活动时的错误码和提示文案不会在多个函数里重复维护。
pub(super) async fn require_activity(
  state: &AppState,
  legacy_activity_id: i64,
) -> Result<activity_repo::ActivityRow, AppError> {
  activity_repo::find_activity_by_id(state.pool(), legacy_activity_id)
    .await?
    .ok_or_else(missing_activity_error)
}

pub(super) fn missing_activity_error() -> AppError {
  AppError::business(
    "invalid_activity",
    "活动不存在或已下线",
    Some("invalid_activity"),
  )
}

#[cfg(test)]
mod tests {
  use super::missing_activity_error;

  #[test]
  fn missing_activity_should_use_contract_error_code() {
    let error = missing_activity_error();
    assert_eq!(error.status(), "invalid_activity");
    assert_eq!(error.error_code(), Some("invalid_activity"));
  }
}
