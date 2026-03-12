ALTER TABLE web_passkey_credential
  ADD COLUMN credential_public_key TEXT NULL,
  ADD COLUMN sign_count BIGINT NOT NULL DEFAULT 0;
