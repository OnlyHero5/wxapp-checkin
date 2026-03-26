use crate::api::activity::{
  ActivityDetailResponse, ActivityListResponse, ActivitySummaryItem, CodeSessionResponse,
};
use crate::api::auth_extractor::CurrentUser;
use crate::app_state::AppState;
use crate::db::activity_repo::{self, ActivityRow, UserActivityRow};
use crate::db::log_repo;
use crate::domain::{
  WebRole, activity_type_from_legacy, format_activity_id, parse_activity_id,
  progress_status_from_legacy,
};
use crate::error::AppError;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_PAGE: i64 = 1;
const DEFAULT_PAGE_SIZE: i64 = 50;
const MAX_PAGE_SIZE: i64 = 200;
const ROTATE_SECONDS: u64 = 10;

type HmacSha256 = Hmac<Sha256>;

pub async fn list_activities(
  state: &AppState,
  current_user: &CurrentUser,
  page: Option<i64>,
  page_size: Option<i64>,
) -> Result<ActivityListResponse, AppError> {
  let normalized_page = normalize_page(page);
  let normalized_page_size = normalize_page_size(page_size)?;
  let offset = (normalized_page - 1) * normalized_page_size;
  let limit = normalized_page_size + 1;
  let role = role_from_user(current_user);

  let mut rows = match role {
    WebRole::Staff => activity_repo::list_staff_activities(state.pool(), limit, offset).await?,
    WebRole::Normal => {
      activity_repo::list_normal_activities(state.pool(), &current_user.student_id, limit, offset)
        .await?
    }
  };

  let has_more = rows.len() as i64 > normalized_page_size;
  if has_more {
    rows.truncate(normalized_page_size as usize);
  }

  let mut activities = Vec::with_capacity(rows.len());
  for row in rows {
    let user_activity = activity_repo::find_user_activity(
      state.pool(),
      row.legacy_activity_id,
      &current_user.student_id,
    )
    .await?;
    activities.push(to_summary(&row, user_activity.as_ref()));
  }

  Ok(ActivityListResponse {
    status: "success".to_string(),
    message: "活动列表获取成功".to_string(),
    activities,
    page: normalized_page,
    page_size: normalized_page_size,
    has_more,
    server_time_ms: now_millis()?,
  })
}

pub async fn get_activity_detail(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
) -> Result<ActivityDetailResponse, AppError> {
  let legacy_activity_id = parse_activity_id(activity_id)?;
  let activity = activity_repo::find_activity_by_id(state.pool(), legacy_activity_id)
    .await?
    .ok_or_else(|| {
      AppError::business(
        "invalid_activity",
        "活动不存在或已下线",
        Some("invalid_activity"),
      )
    })?;
  let user_activity =
    activity_repo::find_user_activity(state.pool(), legacy_activity_id, &current_user.student_id)
      .await?;
  if role_from_user(current_user) == WebRole::Normal
    && !is_visible_for_normal(user_activity.as_ref())
  {
    return Err(AppError::business(
      "forbidden",
      "你无权查看该活动详情",
      None,
    ));
  }

  let within_window = is_within_issue_window(&activity, SystemTime::now())?;
  let my_registered = user_activity
    .as_ref()
    .map(|row| is_registered_apply_state(row.state))
    .unwrap_or(false);
  let my_checked_in = user_activity.as_ref().map(is_checked_in).unwrap_or(false);
  let my_checked_out = user_activity.as_ref().map(is_checked_out).unwrap_or(false);
  let activity_not_completed = progress_status_from_legacy(activity.legacy_state) != "completed";
  let can_checkin =
    within_window && activity_not_completed && my_registered && !my_checked_in && !my_checked_out;
  let can_checkout = within_window && activity_not_completed && my_checked_in && !my_checked_out;
  let my_checkin_time = if my_checked_in || my_checked_out {
    log_repo::find_latest_action_time(
      state.pool(),
      &current_user.student_id,
      "checkin",
      legacy_activity_id,
    )
    .await?
    .map(format_display_time)
    .unwrap_or_default()
  } else {
    String::new()
  };
  let my_checkout_time = if my_checked_out {
    log_repo::find_latest_action_time(
      state.pool(),
      &current_user.student_id,
      "checkout",
      legacy_activity_id,
    )
    .await?
    .map(format_display_time)
    .unwrap_or_default()
  } else {
    String::new()
  };

  Ok(ActivityDetailResponse {
    status: "success".to_string(),
    message: "活动详情获取成功".to_string(),
    activity_id: format_activity_id(activity.legacy_activity_id),
    activity_title: activity.activity_title,
    activity_type: activity_type_from_legacy(activity.legacy_type).to_string(),
    start_time: format_display_time(activity.activity_stime),
    location: activity.location.unwrap_or_default(),
    description: activity.description.unwrap_or_default(),
    progress_status: progress_status_from_legacy(activity.legacy_state).to_string(),
    support_checkout: true,
    support_checkin: true,
    has_detail: true,
    registered_count: activity.registered_count,
    checkin_count: activity.checkin_count,
    checkout_count: activity.checkout_count,
    my_registered,
    my_checked_in,
    my_checked_out,
    my_checkin_time,
    my_checkout_time,
    can_checkin,
    can_checkout,
    server_time_ms: now_millis()?,
  })
}

pub async fn issue_code_session(
  state: &AppState,
  current_user: &CurrentUser,
  activity_id: &str,
  action_type: &str,
) -> Result<CodeSessionResponse, AppError> {
  if role_from_user(current_user) != WebRole::Staff {
    return Err(AppError::business(
      "forbidden",
      "仅工作人员可获取动态码",
      None,
    ));
  }
  let normalized_action_type = normalize_action_type(action_type)?;
  let legacy_activity_id = parse_activity_id(activity_id)?;
  let activity = activity_repo::find_activity_by_id(state.pool(), legacy_activity_id)
    .await?
    .ok_or_else(|| {
      AppError::business(
        "invalid_activity",
        "活动不存在或已下线",
        Some("invalid_activity"),
      )
    })?;
  ensure_activity_time_valid(&activity)?;
  ensure_activity_action_allowed(&activity, normalized_action_type)?;
  ensure_within_issue_window(&activity, SystemTime::now())?;

  let server_time_ms = now_millis()?;
  let slot_window_ms = ROTATE_SECONDS * 1000;
  let slot = server_time_ms / slot_window_ms;
  let expires_at = (slot + 1) * slot_window_ms;
  let expires_in_ms = expires_at.saturating_sub(server_time_ms);
  let code = generate_code(
    &state.config().qr_signing_key,
    &format_activity_id(activity.legacy_activity_id),
    normalized_action_type,
    slot,
  )?;

  Ok(CodeSessionResponse {
    status: "success".to_string(),
    message: "动态码获取成功".to_string(),
    activity_id: format_activity_id(activity.legacy_activity_id),
    action_type: normalized_action_type.to_string(),
    code,
    expires_at,
    expires_in_ms,
    server_time_ms,
    registered_count: activity.registered_count,
    checkin_count: activity.checkin_count,
    checkout_count: activity.checkout_count,
  })
}

pub fn validate_dynamic_code(
  signing_key: &str,
  activity_id: &str,
  action_type: &str,
  code: &str,
  now_ms: u64,
) -> Result<u64, AppError> {
  let normalized_action_type = normalize_action_type(action_type)?;
  let normalized_code = code.trim();
  if normalized_code.is_empty() {
    return Err(AppError::business(
      "invalid_code",
      "动态码错误，请重新确认",
      None,
    ));
  }

  let slot_window_ms = ROTATE_SECONDS * 1000;
  let current_slot = now_ms / slot_window_ms;
  let current_code = generate_code(
    signing_key,
    activity_id,
    normalized_action_type,
    current_slot,
  )?;
  if current_code == normalized_code {
    return Ok(current_slot);
  }
  if current_slot > 0 {
    let previous_code = generate_code(
      signing_key,
      activity_id,
      normalized_action_type,
      current_slot - 1,
    )?;
    if previous_code == normalized_code {
      return Err(AppError::business(
        "expired",
        "动态码已过期，请重新输入最新验证码",
        Some("expired"),
      ));
    }
  }

  Err(AppError::business(
    "invalid_code",
    "动态码错误，请重新确认",
    Some("invalid_code"),
  ))
}

pub fn is_registered_apply_state(value: i32) -> bool {
  value == 0 || value == 2
}

pub fn is_checked_in(row: &UserActivityRow) -> bool {
  row.check_in_flag == 1 && row.check_out_flag == 0
}

pub fn is_checked_out(row: &UserActivityRow) -> bool {
  row.check_in_flag == 1 && row.check_out_flag == 1
}

pub fn format_display_time(value: chrono::NaiveDateTime) -> String {
  value.format("%Y-%m-%d %H:%M").to_string()
}

pub fn is_within_issue_window(activity: &ActivityRow, now: SystemTime) -> Result<bool, AppError> {
  let now_ms = system_time_to_millis(now)?;
  let (start_ms, end_ms) = ensure_activity_time_valid(activity)?;
  Ok(now_ms >= start_ms.saturating_sub(30 * 60 * 1000) && now_ms <= end_ms + 30 * 60 * 1000)
}

fn ensure_activity_time_valid(activity: &ActivityRow) -> Result<(u64, u64), AppError> {
  let start_ms =
    naive_millis(activity.activity_stime).map_err(|_| invalid_activity_time_error())?;
  let end_ms = naive_millis(activity.activity_etime).map_err(|_| invalid_activity_time_error())?;
  if end_ms < start_ms {
    return Err(invalid_activity_time_error());
  }
  Ok((start_ms, end_ms))
}

fn ensure_within_issue_window(activity: &ActivityRow, now: SystemTime) -> Result<(), AppError> {
  if !is_within_issue_window(activity, now)? {
    return Err(AppError::business(
      "forbidden",
      "仅可在活动开始前30分钟到结束后30分钟内生成动态码",
      Some("outside_activity_time_window"),
    ));
  }
  Ok(())
}

fn ensure_activity_action_allowed(
  activity: &ActivityRow,
  action_type: &str,
) -> Result<(), AppError> {
  if progress_status_from_legacy(activity.legacy_state) == "completed" {
    return Err(AppError::business(
      "forbidden",
      "活动已结束，无法生成动态码",
      None,
    ));
  }
  if action_type != "checkin" && action_type != "checkout" {
    return Err(AppError::business(
      "invalid_param",
      "action_type 仅支持 checkin/checkout",
      None,
    ));
  }
  Ok(())
}

fn invalid_activity_time_error() -> AppError {
  AppError::business(
    "forbidden",
    "活动时间信息异常，请先修复活动时间数据",
    Some("activity_time_invalid"),
  )
}

fn to_summary(
  activity: &ActivityRow,
  user_activity: Option<&UserActivityRow>,
) -> ActivitySummaryItem {
  ActivitySummaryItem {
    activity_id: format_activity_id(activity.legacy_activity_id),
    activity_title: activity.activity_title.clone(),
    activity_type: activity_type_from_legacy(activity.legacy_type).to_string(),
    start_time: format_display_time(activity.activity_stime),
    location: activity.location.clone().unwrap_or_default(),
    description: activity.description.clone().unwrap_or_default(),
    progress_status: progress_status_from_legacy(activity.legacy_state).to_string(),
    support_checkout: true,
    support_checkin: true,
    registered_count: activity.registered_count,
    checkin_count: activity.checkin_count,
    checkout_count: activity.checkout_count,
    my_registered: user_activity
      .map(|row| is_registered_apply_state(row.state))
      .unwrap_or(false),
    my_checked_in: user_activity.map(is_checked_in).unwrap_or(false),
    my_checked_out: user_activity.map(is_checked_out).unwrap_or(false),
  }
}

fn role_from_user(current_user: &CurrentUser) -> WebRole {
  if current_user.role == "staff" {
    WebRole::Staff
  } else {
    WebRole::Normal
  }
}

fn is_visible_for_normal(user_activity: Option<&UserActivityRow>) -> bool {
  user_activity
    .map(|row| is_registered_apply_state(row.state) || row.check_in_flag == 1)
    .unwrap_or(false)
}

fn normalize_page(value: Option<i64>) -> i64 {
  match value {
    Some(page) if page > 0 => page,
    _ => DEFAULT_PAGE,
  }
}

fn normalize_page_size(value: Option<i64>) -> Result<i64, AppError> {
  match value {
    Some(page_size) if page_size > MAX_PAGE_SIZE => Err(AppError::business(
      "invalid_param",
      format!("page_size 过大，最大允许 {MAX_PAGE_SIZE}"),
      None,
    )),
    Some(page_size) if page_size > 0 => Ok(page_size),
    _ => Ok(DEFAULT_PAGE_SIZE),
  }
}

fn normalize_action_type(value: &str) -> Result<&str, AppError> {
  match value.trim() {
    "checkin" => Ok("checkin"),
    "checkout" => Ok("checkout"),
    _ => Err(AppError::business(
      "invalid_param",
      "action_type 仅支持 checkin/checkout",
      None,
    )),
  }
}

fn generate_code(
  signing_key: &str,
  activity_id: &str,
  action_type: &str,
  slot: u64,
) -> Result<String, AppError> {
  let mut mac = HmacSha256::new_from_slice(signing_key.as_bytes())
    .map_err(|error| AppError::internal(format!("初始化动态码签名器失败：{error}")))?;
  mac.update(format!("web-code:v1|{activity_id}|{action_type}|{slot}").as_bytes());
  let digest = mac.finalize().into_bytes();
  let value = i32::from_be_bytes([digest[0], digest[1], digest[2], digest[3]]).wrapping_abs()
    as u32
    % 1_000_000;
  Ok(format!("{value:06}"))
}

fn now_millis() -> Result<u64, AppError> {
  system_time_to_millis(SystemTime::now())
}

fn system_time_to_millis(value: SystemTime) -> Result<u64, AppError> {
  value
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .map_err(|_| AppError::internal("系统时间早于 UNIX_EPOCH"))
}

fn naive_millis(value: chrono::NaiveDateTime) -> Result<u64, AppError> {
  let timestamp = value.and_utc().timestamp_millis();
  u64::try_from(timestamp).map_err(|_| AppError::internal("活动时间非法"))
}

#[cfg(test)]
mod tests {
  use super::{
    ensure_activity_time_valid, format_display_time, generate_code, is_registered_apply_state,
    validate_dynamic_code,
  };
  use crate::db::activity_repo::ActivityRow;

  fn sample_activity_row(start: chrono::NaiveDateTime, end: chrono::NaiveDateTime) -> ActivityRow {
    ActivityRow {
      legacy_activity_id: 101,
      activity_title: "测试活动".to_string(),
      description: Some("desc".to_string()),
      location: Some("loc".to_string()),
      activity_stime: start,
      activity_etime: end,
      legacy_type: 1,
      legacy_state: 1,
      registered_count: 0,
      checkin_count: 0,
      checkout_count: 0,
    }
  }

  #[test]
  fn activity_code_should_be_stable_for_same_slot() {
    let code_a = generate_code("test-secret", "legacy_act_101", "checkin", 12).expect("code");
    let code_b = generate_code("test-secret", "legacy_act_101", "checkin", 12).expect("code");
    assert_eq!(code_a, code_b);
  }

  #[test]
  fn previous_slot_code_should_be_marked_expired() {
    let previous_code =
      generate_code("test-secret", "legacy_act_101", "checkin", 11).expect("code");
    let error = validate_dynamic_code(
      "test-secret",
      "legacy_act_101",
      "checkin",
      &previous_code,
      12 * 10 * 1000,
    )
    .expect_err("should expire");
    assert_eq!(error.error_code(), Some("expired"));
  }

  #[test]
  fn registered_apply_state_should_match_legacy_rules() {
    assert!(is_registered_apply_state(0));
    assert!(is_registered_apply_state(2));
    assert!(!is_registered_apply_state(1));
  }

  #[test]
  fn display_time_should_keep_ui_format() {
    let naive = chrono::NaiveDate::from_ymd_opt(2026, 3, 25)
      .expect("date")
      .and_hms_opt(20, 4, 0)
      .expect("time");
    assert_eq!(format_display_time(naive), "2026-03-25 20:04");
  }

  #[test]
  fn invalid_activity_time_should_use_contract_error_code() {
    let start = chrono::NaiveDate::from_ymd_opt(2026, 3, 25)
      .expect("date")
      .and_hms_opt(20, 4, 0)
      .expect("time");
    let end = chrono::NaiveDate::from_ymd_opt(2026, 3, 25)
      .expect("date")
      .and_hms_opt(19, 59, 0)
      .expect("time");
    let activity = sample_activity_row(start, end);

    let error = ensure_activity_time_valid(&activity).expect_err("should reject invalid time");
    assert_eq!(error.status(), "forbidden");
    assert_eq!(error.error_code(), Some("activity_time_invalid"));
  }
}
