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
);

CREATE TABLE IF NOT EXISTS web_passkey_credential (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  binding_id BIGINT NOT NULL,
  credential_id VARCHAR(255) NOT NULL,
  raw_credential_id VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  attestation_object TEXT NULL,
  client_data_json TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_used_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  UNIQUE KEY uk_web_passkey_credential_id (credential_id),
  UNIQUE KEY uk_web_passkey_binding_active (binding_id, active),
  CONSTRAINT fk_web_passkey_credential_user FOREIGN KEY (user_id) REFERENCES wx_user_auth_ext(id),
  CONSTRAINT fk_web_passkey_credential_binding FOREIGN KEY (binding_id) REFERENCES web_browser_binding(id)
);

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
);

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
);
