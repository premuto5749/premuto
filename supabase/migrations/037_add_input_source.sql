ALTER TABLE daily_logs
  ADD COLUMN input_source VARCHAR(10) DEFAULT 'manual';

COMMENT ON COLUMN daily_logs.input_source IS 'preset or manual';
