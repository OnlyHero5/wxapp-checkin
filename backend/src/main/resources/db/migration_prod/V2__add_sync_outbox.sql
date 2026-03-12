CREATE TABLE IF NOT EXISTS wx_sync_outbox (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload_json TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_wx_sync_outbox_status_available (status, available_at),
  KEY idx_wx_sync_outbox_aggregate (aggregate_type, aggregate_id)
);
