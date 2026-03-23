-- Add registered_count to wx_activity_projection.
--
-- 维护说明：
-- 1. 这列用于管理端展示“应到人数”；
-- 2. prod profile 走独立的 migration_prod 目录，必须单独补这次迁移；
-- 3. 否则代码已开始读取 registered_count，但线上库仍停留在旧结构，会直接报 Unknown column。
ALTER TABLE wx_activity_projection
  ADD COLUMN registered_count INT NOT NULL DEFAULT 0
  AFTER checkout_count;
