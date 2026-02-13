import { Job, JobStats, JobStatus, JobType, CreateJobRequest } from '../types';

const JOB_TYPES: JobType[] = [
  'data-processing',
  'report-generation',
  'email-notification',
  'file-export',
  'data-sync',
  'image-resize',
  'pdf-generation',
  'webhook-delivery',
];

const STATUSES: JobStatus[] = ['pending', 'processing', 'completed', 'failed'];

function randomId(): string {
  return `job_${Math.random().toString(36).substring(2, 10)}`;
}

function randomDate(daysBack: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - Math.floor(Math.random() * daysBack * 24 * 60));
  return date.toISOString();
}

function randomPayload(type: JobType): Record<string, unknown> {
  const payloads: Record<JobType, Record<string, unknown>> = {
    'data-processing': { source: 'warehouse-db', table: 'transactions', filters: { date_range: 'last_30d' }, batch_size: 5000 },
    'report-generation': { report_type: 'quarterly_summary', format: 'pdf', include_charts: true, recipients: ['team@example.com'] },
    'email-notification': { template: 'welcome_email', to: 'user@example.com', variables: { name: 'Alice', plan: 'Pro' } },
    'file-export': { format: 'csv', dataset: 'user_analytics', compression: 'gzip', destination: 's3://exports/' },
    'data-sync': { source: 'crm', destination: 'analytics-db', entity: 'contacts', mode: 'incremental' },
    'image-resize': { source_url: 'https://cdn.example.com/img/hero.png', dimensions: { width: 1200, height: 630 }, quality: 85 },
    'pdf-generation': { template_id: 'invoice_v2', data: { invoice_number: 'INV-2024-001', amount: 2450.00 } },
    'webhook-delivery': { url: 'https://hooks.example.com/events', event: 'order.completed', retry_count: 3 },
  };
  return payloads[type];
}

function generateMockJobs(count: number): Job[] {
  const jobs: Job[] = [];
  for (let i = 0; i < count; i++) {
    const type = JOB_TYPES[Math.floor(Math.random() * JOB_TYPES.length)];
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    const createdAt = randomDate(7);
    const updatedAt = new Date(new Date(createdAt).getTime() + Math.random() * 3600000).toISOString();

    const job: Job = {
      id: randomId(),
      type,
      status,
      payload: randomPayload(type),
      createdAt,
      updatedAt,
    };

    if (status === 'completed') {
      job.completedAt = updatedAt;
      job.result = { success: true, records_processed: Math.floor(Math.random() * 10000), duration_ms: Math.floor(Math.random() * 30000) };
    }

    if (status === 'failed') {
      job.error = [
        'Connection timeout after 30s',
        'Rate limit exceeded (429)',
        'Invalid payload: missing required field "email"',
        'Out of memory: heap allocation failed',
        'Permission denied: insufficient credentials',
      ][Math.floor(Math.random() * 5)];
    }

    jobs.push(job);
  }

  return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Persistent mock data store
let mockJobs = generateMockJobs(24);

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchJobs(): Promise<Job[]> {
  await delay(400 + Math.random() * 300);
  // Randomly update a processing job's status to simulate progress
  mockJobs = mockJobs.map((job) => {
    if (job.status === 'processing' && Math.random() > 0.85) {
      const newStatus = Math.random() > 0.2 ? 'completed' : 'failed';
      return {
        ...job,
        status: newStatus as JobStatus,
        updatedAt: new Date().toISOString(),
        ...(newStatus === 'completed'
          ? { completedAt: new Date().toISOString(), result: { success: true, records_processed: Math.floor(Math.random() * 10000) } }
          : { error: 'Process terminated unexpectedly' }),
      };
    }
    return job;
  });
  return [...mockJobs];
}

export async function fetchJob(id: string): Promise<Job | null> {
  await delay(250 + Math.random() * 200);
  return mockJobs.find((j) => j.id === id) ?? null;
}

export async function fetchJobStats(): Promise<JobStats> {
  await delay(300 + Math.random() * 200);
  const stats: JobStats = { pending: 0, processing: 0, completed: 0, failed: 0, total: mockJobs.length };
  for (const job of mockJobs) {
    stats[job.status]++;
  }
  return stats;
}

export async function createJob(request: CreateJobRequest): Promise<Job> {
  await delay(500 + Math.random() * 300);
  const now = new Date().toISOString();
  const job: Job = {
    id: randomId(),
    type: request.type,
    status: 'pending',
    payload: request.payload,
    createdAt: now,
    updatedAt: now,
  };
  mockJobs.unshift(job);

  // Simulate the job starting processing after a short delay
  setTimeout(() => {
    const idx = mockJobs.findIndex((j) => j.id === job.id);
    if (idx !== -1 && mockJobs[idx].status === 'pending') {
      mockJobs[idx] = { ...mockJobs[idx], status: 'processing', updatedAt: new Date().toISOString() };
    }
  }, 2000 + Math.random() * 3000);

  return job;
}
