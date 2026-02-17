export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type JobType =
  | 'data-processing'
  | 'report-generation'
  | 'email-notification'
  | 'file-export'
  | 'data-sync'
  | 'image-resize'
  | 'pdf-generation'
  | 'webhook-delivery';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface CreateJobRequest {
  type: JobType;
  payload: Record<string, unknown>;
}

// Hiring Portal Types

export type AssessmentStatus = 'draft' | 'active' | 'archived';

export type CandidateStatus = 'invited' | 'in_progress' | 'completed' | 'scored';

export interface Assessment {
  id: string;
  title: string;
  description: string | null;
  role: string;
  rubric: RubricCriteria[];
  config: AssessmentConfig;
  status: AssessmentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubricCriteria {
  name: string;
  weight: number;
  description: string;
}

export interface AssessmentConfig {
  tech_stack?: string[];
  interview_duration_minutes?: number;
  pr_review_enabled?: boolean;
}

export interface Candidate {
  id: string;
  assessment_id: string;
  name: string;
  email: string;
  status: CandidateStatus;
  metadata: Record<string, unknown>;
  overall_score?: number;
  created_at: string;
  updated_at: string;
}

export interface Score {
  id: string;
  candidate_id: string;
  assessment_id: string;
  overall_score: number;
  breakdown: Record<string, number>;
  reasoning: string;
  scored_at: string;
}

export interface InterviewSession {
  id: string;
  candidate_id: string;
  assessment_id: string;
  status: string;
  conversation: ConversationMessage[];
  started_at: string | null;
  completed_at: string | null;
}

export interface ConversationMessage {
  role: 'interviewer' | 'candidate';
  content: string;
  timestamp: string;
}

export interface PrExercise {
  id: string;
  candidate_id: string;
  assessment_id: string;
  status: string;
  generated_data: {
    title: string;
    description: string;
    diff: string;
  };
  submission: PrReviewSubmission | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface PrReviewSubmission {
  comments: PrComment[];
  summary: string;
}

export interface PrComment {
  line: number;
  file: string;
  body: string;
  type: 'issue' | 'suggestion' | 'praise';
}

export interface BehavioralSignal {
  id: string;
  candidate_id: string;
  signal_type: string;
  data: Record<string, unknown>;
  recorded_at: string;
}

export interface CreateAssessmentRequest {
  title: string;
  description?: string;
  role: string;
  tech_stack?: string[];
  job_description?: string;
}
