use super::ensure_activity_action_allowed;
use super::ensure_activity_time_valid;
use super::format_display_time;
use super::is_anomalous_attendance_state;
use super::is_registered_apply_state;
use super::is_within_issue_window;
use crate::db::activity_repo::ActivityRow;
use crate::db::activity_repo::UserActivityRow;
use std::time::{Duration, UNIX_EPOCH};

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

#[test]
fn issue_window_should_treat_legacy_datetime_as_china_local_time() {
  let start = chrono::NaiveDate::from_ymd_opt(2026, 4, 5)
    .expect("date")
    .and_hms_opt(17, 12, 0)
    .expect("time");
  let end = chrono::NaiveDate::from_ymd_opt(2026, 4, 5)
    .expect("date")
    .and_hms_opt(18, 0, 0)
    .expect("time");
  let activity = sample_activity_row(start, end);
  let now = UNIX_EPOCH + Duration::from_millis(1_775_380_080_000);

  assert!(
    is_within_issue_window(&activity, now).expect("issue window"),
    "17:12 开始的活动在北京时间 17:08 应已进入发码窗口"
  );
}

#[test]
fn completed_activity_should_still_allow_issue_window_checks_to_drive_code_availability() {
  let start = chrono::NaiveDate::from_ymd_opt(2026, 4, 5)
    .expect("date")
    .and_hms_opt(17, 12, 0)
    .expect("time");
  let end = chrono::NaiveDate::from_ymd_opt(2026, 4, 5)
    .expect("date")
    .and_hms_opt(18, 0, 0)
    .expect("time");
  let activity = ActivityRow {
    legacy_activity_id: 101,
    activity_title: "测试活动".to_string(),
    description: Some("desc".to_string()),
    location: Some("loc".to_string()),
    activity_stime: start,
    activity_etime: end,
    legacy_type: 1,
    legacy_state: 4,
    registered_count: 0,
    checkin_count: 0,
    checkout_count: 0,
  };

  let result = ensure_activity_action_allowed(&activity, crate::domain::AttendanceActionType::Checkout);

  assert!(
    result.is_ok(),
    "活动结束后 30 分钟窗口内，发码/签退可执行性应由时间窗驱动，而不是被 completed 提前硬拦截"
  );
}

#[test]
fn anomalous_attendance_state_should_be_detected() {
  let row = UserActivityRow {
    username: "2025000011".to_string(),
    state: 0,
    check_in_flag: 0,
    check_out_flag: 1,
  };

  assert!(
    is_anomalous_attendance_state(&row),
    "只签退未签到属于脏状态，不能继续被普通用户链路当成可修复状态"
  );
}
