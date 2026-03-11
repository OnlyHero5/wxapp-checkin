-- Add retry_count for outbox relay retries (integration test report 2026-03-11).

ALTER TABLE wx_sync_outbox
  ADD COLUMN retry_count INT NOT NULL DEFAULT 0;

