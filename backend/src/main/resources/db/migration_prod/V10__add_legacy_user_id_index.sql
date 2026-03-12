-- 为 legacy_user_id 增加索引，避免登录/查人路径退化成全表扫描。
-- 说明：该字段来自 legacy（suda_union）用户主键，查询频率高但写入频率低，适合单列索引。

CREATE INDEX idx_wx_user_auth_ext_legacy_user_id
  ON wx_user_auth_ext (legacy_user_id);

