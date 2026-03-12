ALTER TABLE wx_user_auth_ext
  ADD COLUMN password_hash VARCHAR(255) NULL;

ALTER TABLE wx_user_auth_ext
  ADD COLUMN must_change_password TINYINT(1) NULL;

ALTER TABLE wx_user_auth_ext
  ADD COLUMN password_updated_at DATETIME(3) NULL;
