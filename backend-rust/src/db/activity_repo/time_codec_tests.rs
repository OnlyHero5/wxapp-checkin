use super::parse_legacy_activity_time_text;

#[test]
fn parse_legacy_activity_time_text_should_keep_beijing_wall_clock_time() {
  /**
   * 这个断言直接对应线上回归：
   * - `wxapp-checkin` 当前把 MySQL 会话时区固定成 `+08:00`；
   * - 旧 `suda_activity` 的 `TIMESTAMP` 实际保存的是“北京时间墙上时间”；
   * - 因此仓储层拿到的 `07:10` 文本，必须折回成用户原本录入的 `23:10`。
   */
  let parsed = parse_legacy_activity_time_text("2026-04-12 07:10:00")
    .expect("should parse legacy activity time text");

  let expected = chrono::NaiveDate::from_ymd_opt(2026, 4, 11)
    .expect("date")
    .and_hms_opt(23, 10, 0)
    .expect("time");

  assert_eq!(parsed, expected);
}
