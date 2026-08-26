-- Retention for airspace aggregates.
--
-- `airspace_samples` gains roughly 960 rows a day and had no ceiling. Analytics only
-- reads the last 24 hours, so anything older was being kept for nothing. Trimming is
-- driven by ingestion rather than a database job so the policy stays visible in the
-- application rather than hidden in server config.
CREATE INDEX IF NOT EXISTS airspace_samples_retention_idx
  ON airspace_samples (observed_at);

COMMENT ON TABLE airspace_samples IS
  'Aggregate airspace observations, one row per ingestion poll. Trimmed to ANALYTICS_RETENTION_HOURS by the ingestion sampler.';
