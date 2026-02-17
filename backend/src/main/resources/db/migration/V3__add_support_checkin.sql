-- Add support_checkin column to wx_activity_projection
ALTER TABLE wx_activity_projection
  ADD COLUMN support_checkin TINYINT(1) NOT NULL DEFAULT 1
  AFTER support_checkout;
