-- Production bootstrap schema for wxcheckin_ext.
-- This script creates extension tables only, without inserting demo data.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS wx_user_auth_ext (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  legacy_user_id BIGINT NULL,
  wx_identity VARCHAR(128) NOT NULL,
  wx_token VARCHAR(255) NULL,
  token_ciphertext VARCHAR(512) NULL,
  token_expires_at DATETIME(3) NULL,
  student_id VARCHAR(32) NULL,
  name VARCHAR(64) NULL,
  password_hash VARCHAR(255) NULL,
  must_change_password TINYINT(1) NULL,
  password_updated_at DATETIME(3) NULL,
  department VARCHAR(128) NULL,
  club VARCHAR(128) NULL,
  avatar_url VARCHAR(512) NULL,
  social_score INT NOT NULL DEFAULT 0,
  lecture_score INT NOT NULL DEFAULT 0,
  role_code VARCHAR(16) NOT NULL DEFAULT 'normal',
  permissions_json TEXT NOT NULL,
  registered TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_wx_user_auth_ext_wx_identity (wx_identity),
  UNIQUE KEY uk_wx_user_auth_ext_student_id (student_id),
  KEY idx_wx_user_auth_ext_legacy_user_id (legacy_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wx_admin_roster (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_wx_admin_roster_sid_name (student_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wx_session (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_token VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  role_snapshot VARCHAR(16) NOT NULL,
  permissions_json TEXT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_access_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_wx_session_token (session_token),
  KEY idx_wx_session_user (user_id),
  KEY idx_wx_session_expires (expires_at),
  CONSTRAINT fk_wx_session_user FOREIGN KEY (user_id) REFERENCES wx_user_auth_ext(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wx_activity_projection (
  activity_id VARCHAR(64) NOT NULL PRIMARY KEY,
  legacy_activity_id INT NULL,
  activity_title VARCHAR(255) NOT NULL,
  activity_type VARCHAR(64) NOT NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT NULL,
  progress_status VARCHAR(16) NOT NULL,
  support_checkout TINYINT(1) NOT NULL DEFAULT 1,
  support_checkin TINYINT(1) NOT NULL DEFAULT 1,
  has_detail TINYINT(1) NOT NULL DEFAULT 1,
  checkin_count INT NOT NULL DEFAULT 0,
  checkout_count INT NOT NULL DEFAULT 0,
  -- registered_count 表示“报名成功 + 候补成功”的人数（即应到人数）。
  -- compose fresh 库也必须带上这列，避免 backend 首次启动时实体字段先于 schema 生效。
  registered_count INT NOT NULL DEFAULT 0,
  rotate_seconds INT NOT NULL DEFAULT 10,
  grace_seconds INT NOT NULL DEFAULT 20,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_wx_activity_projection_start (start_time),
  KEY idx_wx_activity_projection_progress (progress_status),
  KEY idx_wx_activity_projection_legacy_id (legacy_activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wx_user_activity_status (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  activity_id VARCHAR(64) NOT NULL,
  registered TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'none',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_wx_user_activity_status_user_activity (user_id, activity_id),
  KEY idx_wx_user_activity_status_activity (activity_id),
  CONSTRAINT fk_wx_user_activity_status_user FOREIGN KEY (user_id) REFERENCES wx_user_auth_ext(id),
  CONSTRAINT fk_wx_user_activity_status_activity FOREIGN KEY (activity_id) REFERENCES wx_activity_projection(activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wx_checkin_event (
  record_id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  activity_id VARCHAR(64) NOT NULL,
  action_type VARCHAR(16) NOT NULL,
  slot BIGINT NOT NULL,
  nonce VARCHAR(128) NOT NULL,
  in_grace_window TINYINT(1) NOT NULL DEFAULT 0,
  submitted_at DATETIME(3) NOT NULL,
  server_time BIGINT NOT NULL,
  qr_payload VARCHAR(255) NOT NULL,
  KEY idx_wx_checkin_event_user (user_id),
  KEY idx_wx_checkin_event_activity (activity_id),
  KEY idx_wx_checkin_event_submit (submitted_at),
  CONSTRAINT fk_wx_checkin_event_user FOREIGN KEY (user_id) REFERENCES wx_user_auth_ext(id),
  CONSTRAINT fk_wx_checkin_event_activity FOREIGN KEY (activity_id) REFERENCES wx_activity_projection(activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wx_qr_issue_log (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  activity_id VARCHAR(64) NOT NULL,
  action_type VARCHAR(16) NOT NULL,
  slot BIGINT NOT NULL,
  nonce VARCHAR(128) NOT NULL,
  qr_payload VARCHAR(255) NOT NULL,
  display_expire_at BIGINT NOT NULL,
  accept_expire_at BIGINT NOT NULL,
  issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  issued_by_user_id BIGINT NOT NULL,
  KEY idx_wx_qr_issue_log_payload (qr_payload),
  KEY idx_wx_qr_issue_log_slot (activity_id, action_type, slot),
  KEY idx_wx_qr_issue_log_key (activity_id, action_type, slot, nonce),
  KEY idx_wx_qr_issue_log_accept_expire_at (accept_expire_at),
  CONSTRAINT fk_wx_qr_issue_log_user FOREIGN KEY (issued_by_user_id) REFERENCES wx_user_auth_ext(id),
  CONSTRAINT fk_wx_qr_issue_log_activity FOREIGN KEY (activity_id) REFERENCES wx_activity_projection(activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wx_replay_guard (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  activity_id VARCHAR(64) NOT NULL,
  action_type VARCHAR(16) NOT NULL,
  slot BIGINT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_wx_replay_guard_user_activity_action_slot (user_id, activity_id, action_type, slot),
  KEY idx_wx_replay_guard_expires (expires_at),
  CONSTRAINT fk_wx_replay_guard_user FOREIGN KEY (user_id) REFERENCES wx_user_auth_ext(id),
  CONSTRAINT fk_wx_replay_guard_activity FOREIGN KEY (activity_id) REFERENCES wx_activity_projection(activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wx_sync_outbox (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload_json TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_wx_sync_outbox_status_available (status, available_at),
  KEY idx_wx_sync_outbox_aggregate (aggregate_type, aggregate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Web-only: 解绑审核（V6） =====
CREATE TABLE IF NOT EXISTS web_unbind_review (
  review_id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  requested_new_binding_hint VARCHAR(255) NULL,
  review_comment VARCHAR(255) NULL,
  reviewer_user_id BIGINT NULL,
  submitted_at DATETIME(3) NOT NULL,
  reviewed_at DATETIME(3) NULL,
  KEY idx_web_unbind_review_status (status, submitted_at),
  KEY idx_web_unbind_review_user (user_id),
  CONSTRAINT fk_web_unbind_review_user FOREIGN KEY (user_id) REFERENCES wx_user_auth_ext(id),
  CONSTRAINT fk_web_unbind_review_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES wx_user_auth_ext(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Web-only: 浏览器绑定（V7） =====
CREATE TABLE IF NOT EXISTS web_browser_binding (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  binding_id VARCHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  binding_fingerprint_hash VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL,
  approved_unbind_review_id VARCHAR(64) NULL,
  revoked_reason VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  UNIQUE KEY uk_web_browser_binding_id (binding_id),
  UNIQUE KEY uk_web_browser_binding_user_status (user_id, status),
  UNIQUE KEY uk_web_browser_binding_fingerprint_status (binding_fingerprint_hash, status),
  CONSTRAINT fk_web_browser_binding_user FOREIGN KEY (user_id) REFERENCES wx_user_auth_ext(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Web-only: Passkey 凭证（V7 + V8）=====
-- 维护意图：
-- 1. compose 初始化库需要和当前 prod baseline 能力保持一致；
-- 2. 这里直接落到“已包含 credential_public_key / sign_count”的形态，
--    避免 fresh 库在 Flyway baseline 推断时被判定成“高版本特征存在、低版本表结构缺失”；
-- 3. 该表只负责浏览器 passkey 凭证主数据，不承载一次性挑战态。
CREATE TABLE IF NOT EXISTS web_passkey_credential (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  binding_id BIGINT NOT NULL,
  credential_id VARCHAR(255) NOT NULL,
  raw_credential_id VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  attestation_object TEXT NULL,
  client_data_json TEXT NULL,
  credential_public_key TEXT NULL,
  sign_count BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_used_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  UNIQUE KEY uk_web_passkey_credential_id (credential_id),
  UNIQUE KEY uk_web_passkey_binding_active (binding_id, active),
  CONSTRAINT fk_web_passkey_credential_user FOREIGN KEY (user_id) REFERENCES wx_user_auth_ext(id),
  CONSTRAINT fk_web_passkey_credential_binding FOREIGN KEY (binding_id) REFERENCES web_browser_binding(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Web-only: Passkey 挑战（V7）=====
-- 维护边界：
-- 1. 该表保存注册/登录等一次性 challenge；
-- 2. fresh compose 库必须同时具备 challenge 与 credential 两类表，避免本地联调时 web 身份能力缺表。
CREATE TABLE IF NOT EXISTS web_passkey_challenge (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NULL,
  bind_ticket VARCHAR(64) NULL,
  flow_type VARCHAR(16) NOT NULL,
  user_id BIGINT NOT NULL,
  browser_binding_key VARCHAR(128) NOT NULL,
  credential_id VARCHAR(255) NULL,
  challenge VARCHAR(255) NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_web_passkey_challenge_request_id (request_id),
  UNIQUE KEY uk_web_passkey_challenge_bind_ticket (bind_ticket),
  KEY idx_web_passkey_challenge_expires (expires_at),
  KEY idx_web_passkey_challenge_user_flow (user_id, flow_type),
  CONSTRAINT fk_web_passkey_challenge_user FOREIGN KEY (user_id) REFERENCES wx_user_auth_ext(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS web_admin_audit_log (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  audit_id VARCHAR(64) NOT NULL,
  operator_user_id BIGINT NULL,
  target_user_id BIGINT NULL,
  action_type VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(128) NOT NULL,
  payload_json TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_web_admin_audit_log_audit_id (audit_id),
  KEY idx_web_admin_audit_log_target (target_type, target_id),
  KEY idx_web_admin_audit_log_action (action_type, created_at),
  CONSTRAINT fk_web_admin_audit_log_operator FOREIGN KEY (operator_user_id) REFERENCES wx_user_auth_ext(id),
  CONSTRAINT fk_web_admin_audit_log_target_user FOREIGN KEY (target_user_id) REFERENCES wx_user_auth_ext(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
