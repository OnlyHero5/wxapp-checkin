mod detail;
mod listing;
mod user_activity;

pub use detail::find_activity_by_id;
pub use listing::list_normal_activities;
pub use listing::list_staff_activities;
pub use user_activity::find_user_activities;
pub use user_activity::find_user_activity;

use sqlx::FromRow;

/// 活动读模型统一只暴露接口真正需要的字段。
/// 这样 service 层在做列表、详情和动态码判断时，不需要反复认识底表结构。
#[derive(Debug, Clone, FromRow)]
pub struct ActivityRow {
  pub legacy_activity_id: i64,
  pub activity_title: String,
  pub description: Option<String>,
  pub location: Option<String>,
  pub activity_stime: chrono::NaiveDateTime,
  pub activity_etime: chrono::NaiveDateTime,
  pub legacy_type: i32,
  pub legacy_state: i32,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
}

/// 用户在活动上的报名与打卡状态继续保留成轻量读模型。
/// 这里不直接暴露整行数据库记录，避免 service 被底表列拖着走。
#[derive(Debug, Clone, FromRow)]
pub struct UserActivityRow {
  pub username: String,
  pub state: i32,
  pub check_in_flag: i64,
  pub check_out_flag: i64,
}

/// 列表页批量补齐用户状态时，还需要携带活动 ID 作为索引键。
/// 因此把“活动 ID + 用户状态”单独建成一个批量查询模型。
#[derive(Debug, Clone, FromRow)]
pub struct UserActivityWithActivityIdRow {
  pub legacy_activity_id: i64,
  pub username: String,
  pub state: i32,
  pub check_in_flag: i64,
  pub check_out_flag: i64,
}
