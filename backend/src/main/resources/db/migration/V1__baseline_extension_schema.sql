CREATE TABLE IF NOT EXISTS wx_user_auth_ext (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  legacy_user_id BIGINT NULL,
  wx_identity VARCHAR(128) NOT NULL,
  wx_token VARCHAR(255) NULL,
  token_ciphertext VARCHAR(512) NULL,
  token_expires_at DATETIME(3) NULL,
  student_id VARCHAR(32) NULL,
  name VARCHAR(64) NULL,
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
  UNIQUE KEY uk_wx_user_auth_ext_student_id (student_id)
);

CREATE TABLE IF NOT EXISTS wx_admin_roster (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_wx_admin_roster_sid_name (student_id, name)
);

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
);

CREATE TABLE IF NOT EXISTS wx_activity_projection (
  activity_id VARCHAR(64) NOT NULL PRIMARY KEY,
  legacy_activity_id INT NULL,
  activity_title VARCHAR(255) NOT NULL,
  activity_type VARCHAR(64) NOT NULL,
  start_time DATETIME(3) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT NULL,
  progress_status VARCHAR(16) NOT NULL,
  support_checkout TINYINT(1) NOT NULL DEFAULT 1,
  has_detail TINYINT(1) NOT NULL DEFAULT 1,
  checkin_count INT NOT NULL DEFAULT 0,
  checkout_count INT NOT NULL DEFAULT 0,
  rotate_seconds INT NOT NULL DEFAULT 10,
  grace_seconds INT NOT NULL DEFAULT 20,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_wx_activity_projection_start (start_time),
  KEY idx_wx_activity_projection_progress (progress_status),
  KEY idx_wx_activity_projection_legacy_id (legacy_activity_id)
);

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
);

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
);

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
  CONSTRAINT fk_wx_qr_issue_log_user FOREIGN KEY (issued_by_user_id) REFERENCES wx_user_auth_ext(id),
  CONSTRAINT fk_wx_qr_issue_log_activity FOREIGN KEY (activity_id) REFERENCES wx_activity_projection(activity_id)
);

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
);

INSERT IGNORE INTO wx_admin_roster (student_id, name, active)
VALUES ('2025000007', '刘洋', 1);

INSERT IGNORE INTO wx_activity_projection (
  activity_id, legacy_activity_id, activity_title, activity_type, start_time, location, description,
  progress_status, support_checkout, has_detail, checkin_count, checkout_count, rotate_seconds, grace_seconds, active
) VALUES
  ('act_hackathon_20260215', NULL, '校园 HackDay', '竞赛', '2026-02-15 09:00:00', '创新中心 1F',
   '48 小时团队赛，支持签到与签退。', 'ongoing', 1, 1, 18, 3, 10, 20, 1),
  ('act_ai_workshop_20260210', NULL, 'AI 工具实战工作坊', '工作坊', '2026-02-10 19:30:00', '图书馆创客空间',
   '现场实操课程，支持全程签退统计。', 'ongoing', 1, 1, 32, 8, 10, 20, 1),
  ('act_open_day_20260128', NULL, '学生组织开放日', '展会', '2026-01-28 18:00:00', '大学生活动中心',
   '社团联合展位与招新咨询。', 'completed', 1, 1, 45, 20, 10, 20, 1);
