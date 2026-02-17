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

-- =============================================================================
-- Hiring Portal Schema
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: assessments
-- Recruiter-created assessment definitions. Each assessment describes a hiring
-- evaluation: the role, rubric criteria, configuration for interviews and PR
-- exercises, and overall settings. JSONB fields allow flexible schema evolution.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  role VARCHAR(255) NOT NULL,
  rubric JSONB NOT NULL DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_assessments_created_at ON assessments(created_at DESC);

-- -----------------------------------------------------------------------------
-- Table: candidates
-- Tracks candidates invited to take an assessment. Each candidate gets a unique
-- access token for authenticating into their interview session without needing
-- a full account. The metadata JSONB field stores resume info, source, etc.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  access_token VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'invited',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidates_assessment_id ON candidates(assessment_id);
CREATE INDEX idx_candidates_access_token ON candidates(access_token);
CREATE INDEX idx_candidates_email ON candidates(email);

-- -----------------------------------------------------------------------------
-- Table: interview_sessions
-- Tracks each adaptive interview conversation. A session belongs to a candidate
-- and assessment. The conversation field stores the full chat history as JSONB.
-- The context field holds adaptive state (topics covered, difficulty level, etc).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  conversation JSONB NOT NULL DEFAULT '[]',
  context JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interview_sessions_candidate_id ON interview_sessions(candidate_id);
CREATE INDEX idx_interview_sessions_assessment_id ON interview_sessions(assessment_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);

-- -----------------------------------------------------------------------------
-- Table: pr_exercises
-- PR review exercises presented to candidates. Each exercise contains a generated
-- diff and repository context. The candidate's review (comments, suggestions) is
-- stored in the submission JSONB field. The generated_data field holds the full
-- synthetic PR content produced by the worker.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pr_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  generated_data JSONB NOT NULL DEFAULT '{}',
  submission JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pr_exercises_candidate_id ON pr_exercises(candidate_id);
CREATE INDEX idx_pr_exercises_assessment_id ON pr_exercises(assessment_id);
CREATE INDEX idx_pr_exercises_status ON pr_exercises(status);

-- -----------------------------------------------------------------------------
-- Table: behavioral_signals
-- Passive behavioral observations captured during the assessment. These include
-- timing data, interaction patterns, navigation behavior, and other signals that
-- inform the scoring pipeline. Each signal has a type and flexible JSONB data.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS behavioral_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  session_id UUID REFERENCES interview_sessions(id) ON DELETE SET NULL,
  signal_type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_behavioral_signals_candidate_id ON behavioral_signals(candidate_id);
CREATE INDEX idx_behavioral_signals_assessment_id ON behavioral_signals(assessment_id);
CREATE INDEX idx_behavioral_signals_session_id ON behavioral_signals(session_id);
CREATE INDEX idx_behavioral_signals_signal_type ON behavioral_signals(signal_type);

-- -----------------------------------------------------------------------------
-- Table: scores
-- Final scoring results with reasoning. Each score ties a candidate's assessment
-- to a rubric-based evaluation. The breakdown JSONB field stores per-criterion
-- scores, and the reasoning field captures the AI-generated justification.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  overall_score NUMERIC(5,2),
  breakdown JSONB NOT NULL DEFAULT '{}',
  reasoning TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_candidate_id ON scores(candidate_id);
CREATE INDEX idx_scores_assessment_id ON scores(assessment_id);
