-- QR hardening: improve lookup and cleanup performance for ephemeral tables.

ALTER TABLE wx_qr_issue_log
  ADD INDEX idx_wx_qr_issue_log_key (activity_id, action_type, slot, nonce),
  ADD INDEX idx_wx_qr_issue_log_accept_expire_at (accept_expire_at);

