-- Add registered_count to wx_activity_projection.
--
-- registered_count 口径：
-- - 统计 legacy(suda_union) 中“报名成功 + 候补成功”的人数（即有资格签到/签退的人数）
-- - 用于在管理端展示“应到人数”，与签到/签退统计并列
ALTER TABLE wx_activity_projection
  ADD COLUMN registered_count INT NOT NULL DEFAULT 0
  AFTER checkout_count;

