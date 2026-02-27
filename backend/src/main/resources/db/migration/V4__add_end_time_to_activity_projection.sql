-- Store activity end time for staff issue-window validation.
ALTER TABLE wx_activity_projection
  ADD COLUMN end_time DATETIME(3) NULL
  AFTER start_time;

UPDATE wx_activity_projection
  SET end_time = start_time
  WHERE end_time IS NULL;

ALTER TABLE wx_activity_projection
  MODIFY COLUMN end_time DATETIME(3) NOT NULL;

