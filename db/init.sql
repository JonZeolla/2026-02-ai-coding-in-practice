-- =============================================================================
-- Job Queue Database Schema
-- =============================================================================
--
-- This schema defines the core `jobs` table for an asynchronous job queue
-- system backed by PostgreSQL.
--
-- Table: jobs
--   - id           : Unique identifier for each job (UUID v4, auto-generated).
--   - type         : The kind of job (e.g. "email.send", "report.generate").
--                    Used by workers to determine which handler to invoke.
--   - status       : Current lifecycle state of the job. Expected values:
--                      pending    - Queued and waiting for a worker.
--                      running    - Currently being processed by a worker.
--                      completed  - Finished successfully (result populated).
--                      failed     - Finished with an error (error populated).
--   - payload      : Arbitrary JSON input data supplied when the job is created.
--   - result       : Arbitrary JSON output data written on successful completion.
--   - error        : Human-readable error message written on failure.
--   - created_at   : Timestamp when the job was enqueued.
--   - updated_at   : Timestamp of the most recent status change.
--   - started_at   : Timestamp when a worker began processing the job.
--   - completed_at : Timestamp when the job finished (success or failure).
--
-- Indexes are provided on status, type, and created_at to support efficient
-- polling by workers and time-ordered listing in dashboards.
-- =============================================================================

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
