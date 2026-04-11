mod detail;
mod listing;
mod user_activity;

pub use detail::find_activity_by_id;
pub use listing::list_normal_activities;
pub use listing::list_staff_activities;
pub use user_activity::find_user_activities;
pub use user_activity::find_user_activity;

use crate::error::AppError;
use sqlx::FromRow;

const LEGACY_ACTIVITY_SESSION_OFFSET_HOURS: i64 = 8;

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

/// 活动底表里的时间列目前是 MySQL `TIMESTAMP`。
///
/// 实际线上问题证明：直接让驱动解码到 `NaiveDateTime` 时，
/// 会在部分链路里把北京时间再偏移一次。
/// 因此仓储层先把时间读成固定格式字符串，再显式按“本地墙上时间”解析，
/// 把时区边界收口在这里。
#[derive(Debug, Clone, FromRow)]
pub(super) struct RawActivityRow {
  pub legacy_activity_id: i64,
  pub activity_title: String,
  pub description: Option<String>,
  pub location: Option<String>,
  pub activity_stime: String,
  pub activity_etime: String,
  pub legacy_type: i32,
  pub legacy_state: i32,
  pub registered_count: i64,
  pub checkin_count: i64,
  pub checkout_count: i64,
}

pub(super) fn parse_legacy_activity_time_text(
  value: &str,
) -> Result<chrono::NaiveDateTime, AppError> {
  let parsed = chrono::NaiveDateTime::parse_from_str(value.trim(), "%Y-%m-%d %H:%M:%S")
    .or_else(|_| chrono::NaiveDateTime::parse_from_str(value.trim(), "%Y-%m-%d %H:%M"))
    .map_err(|error| AppError::internal(format!("解析活动时间失败：{error}")))?;

  /**
   * legacy `suda_activity` 的时间列虽然是 `TIMESTAMP`，
   * 但现网数据实际按“北京时间墙上时间”写入了 UTC 会话。
   *
   * 现在连接池统一把会话时区切到 `+08:00`，MySQL 读取时会先把这批旧值再前推 8 小时，
   * 于是用户录入的 23:10 会在查询结果里变成次日 07:10。
   *
   * 仓储层必须在这里把这 8 小时折回去，
   * 后续详情展示、列表排序、发码窗口判断才能继续共用同一份正确时间。
   */
  parsed
    .checked_sub_signed(chrono::Duration::hours(LEGACY_ACTIVITY_SESSION_OFFSET_HOURS))
    .ok_or_else(|| AppError::internal("活动时间折返失败：超出合法范围"))
}

pub(super) fn materialize_activity_row(raw: RawActivityRow) -> Result<ActivityRow, AppError> {
  Ok(ActivityRow {
    legacy_activity_id: raw.legacy_activity_id,
    activity_title: raw.activity_title,
    description: raw.description,
    location: raw.location,
    // 这里显式把固定格式字符串还原成 `NaiveDateTime`，
    // 让后续格式化展示、时间窗口计算都建立在同一份北京时间墙上时间之上。
    activity_stime: parse_legacy_activity_time_text(&raw.activity_stime)?,
    activity_etime: parse_legacy_activity_time_text(&raw.activity_etime)?,
    legacy_type: raw.legacy_type,
    legacy_state: raw.legacy_state,
    registered_count: raw.registered_count,
    checkin_count: raw.checkin_count,
    checkout_count: raw.checkout_count,
  })
}

#[cfg(test)]
#[path = "time_codec_tests.rs"]
mod time_codec_tests;
