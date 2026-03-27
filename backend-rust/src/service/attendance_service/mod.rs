mod audit;
mod consume;
mod state_rules;

pub use consume::consume_code;

use crate::api::auth_extractor::CurrentUser;
use crate::domain::WebRole;
use crate::error::AppError;
use std::time::{SystemTime, UNIX_EPOCH};

/// 当前签到写路径仍然只区分普通用户和工作人员两种角色。
/// 把角色判断下沉成共享帮助函数，避免多个子模块各自复制同一语义。
fn role_from_user(current_user: &CurrentUser) -> WebRole {
  if current_user.role == "staff" {
    WebRole::Staff
  } else {
    WebRole::Normal
  }
}

/// 写路径生成 record_id、slot key 和日志时间时都依赖毫秒级服务端时间。
/// 这里统一封装，确保各子模块共享同一时间错误语义。
fn now_millis() -> Result<u64, AppError> {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH"))
}
