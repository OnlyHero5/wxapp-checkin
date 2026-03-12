-- QR hardening: improve lookup and cleanup performance for ephemeral tables.

-- NOTE:
-- - MySQL 支持 `ALTER TABLE ... ADD INDEX ...`，但 H2（用于 prod profile 单测）不兼容；
-- - 这里改为标准 `CREATE INDEX`，同时兼容 MySQL 与 H2。

CREATE INDEX idx_wx_qr_issue_log_key
  ON wx_qr_issue_log (activity_id, action_type, slot, nonce);

CREATE INDEX idx_wx_qr_issue_log_accept_expire_at
  ON wx_qr_issue_log (accept_expire_at);
