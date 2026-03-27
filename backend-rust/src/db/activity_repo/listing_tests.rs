use super::build_keyword_pattern;
use super::escape_like_keyword;

// 关键字过滤的两条测试都在锁 SQL LIKE 安全边界：
// `%` / `_` 必须被转义，`legacy_act_` 前缀也不能被模糊匹配吞掉。
#[test]
fn escape_like_keyword_should_escape_percent_and_underscore() {
  assert_eq!(escape_like_keyword("奖学金_补录%"), "奖学金\\_补录\\%");
}

#[test]
fn build_keyword_pattern_should_keep_legacy_activity_prefix_literal() {
  assert_eq!(
    build_keyword_pattern("legacy_act_123"),
    "%legacy\\_act\\_123%"
  );
}
