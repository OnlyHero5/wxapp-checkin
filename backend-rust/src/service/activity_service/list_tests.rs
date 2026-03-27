use super::build_user_activity_map;
use super::normalize_keyword;
use crate::db::activity_repo::UserActivityWithActivityIdRow;

#[test]
fn normalize_keyword_should_trim_and_collapse_blank() {
  assert_eq!(normalize_keyword(None).expect("none keyword"), None);
  assert_eq!(
    normalize_keyword(Some("  奖学金补录  ".to_string())).expect("trimmed keyword"),
    Some("奖学金补录".to_string())
  );
  assert_eq!(
    normalize_keyword(Some("   ".to_string())).expect("blank keyword"),
    None
  );
}

#[test]
fn normalize_keyword_should_reject_too_long_value() {
  let error = normalize_keyword(Some("a".repeat(101))).expect_err("should reject long keyword");
  assert_eq!(error.status(), "invalid_param");
  assert_eq!(error.error_code(), None);
}

#[test]
fn build_user_activity_map_should_index_rows_by_activity_id() {
  let activity_map = build_user_activity_map(vec![
    UserActivityWithActivityIdRow {
      legacy_activity_id: 101,
      username: "2025000001".to_string(),
      state: 0,
      check_in_flag: 0,
      check_out_flag: 0,
    },
    UserActivityWithActivityIdRow {
      legacy_activity_id: 202,
      username: "2025000001".to_string(),
      state: 2,
      check_in_flag: 1,
      check_out_flag: 1,
    },
  ]);

  assert_eq!(activity_map.len(), 2);
  assert_eq!(activity_map.get(&101).map(|row| row.state), Some(0));
  assert_eq!(
    activity_map.get(&202).map(|row| row.check_out_flag),
    Some(1)
  );
}
