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
);
