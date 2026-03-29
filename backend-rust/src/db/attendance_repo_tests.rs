use super::build_user_id_lock_sql;

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
