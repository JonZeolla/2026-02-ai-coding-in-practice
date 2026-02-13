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
