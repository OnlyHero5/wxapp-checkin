use super::build_user_id_lock_sql;
use super::build_bulk_checkout_target_sql;

#[test]
fn user_id_lock_sql_should_keep_one_activity_placeholder_before_in_clause() {
  let sql = build_user_id_lock_sql(2);

  assert!(
    sql.contains("WHERE aa.activity_id = ?"),
    "名单修正 SQL 必须先保留 activity_id 条件，不能把事务锁定退化成全表扫描"
  );
  assert!(
    !sql.contains("WHERE aa.activity_id = ??"),
    "名单修正 SQL 不能把原始 `?` 和 QueryBuilder 的 bind 占位符合并成 `??`"
  );
  assert!(
    sql.contains("AND u.id IN (?, ?)"),
    "名单修正 SQL 必须在 activity_id 条件后继续拼接目标 user_id 列表"
  );
}

#[test]
fn bulk_checkout_target_sql_should_cover_all_effective_members_not_only_checked_in_rows() {
  let sql = build_bulk_checkout_target_sql();

  assert!(
    sql.contains("aa.state IN (0, 2)"),
    "一键全部签退必须覆盖所有有效报名成员，而不是只看已签到未签退"
  );
  assert!(
    sql.contains("NOT (aa.check_in = 1 AND aa.check_out = 1)"),
    "一键全部签退应只排除已经完成签退的人"
  );
  assert!(
    !sql.contains("AND aa.check_in = 1\n    AND aa.check_out = 0"),
    "一键全部签退不应再只锁定已签到未签退成员"
  );
}
