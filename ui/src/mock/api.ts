import {
  Job, JobStats, JobStatus, JobType, CreateJobRequest,
  Assessment, Candidate, CandidateStatus,
  Score, InterviewSession, ConversationMessage, PrExercise,
  BehavioralSignal, RubricCriteria, CreateAssessmentRequest,
} from '../types';

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

// =============================================================================
// Hiring Portal Mock Data
// =============================================================================

function assessmentId(): string {
  return `asmt_${Math.random().toString(36).substring(2, 10)}`;
}

function candidateId(): string {
  return `cand_${Math.random().toString(36).substring(2, 10)}`;
}

const TECH_STACKS = [
  ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
  ['Python', 'FastAPI', 'Redis', 'Docker'],
  ['Go', 'gRPC', 'Kubernetes', 'Terraform'],
  ['Java', 'Spring Boot', 'Kafka', 'AWS'],
  ['Rust', 'Axum', 'SQLite', 'WebAssembly'],
];

const RUBRIC_TEMPLATES: RubricCriteria[][] = [
  [
    { name: 'Problem Solving', weight: 25, description: 'Ability to break down complex problems and devise efficient solutions' },
    { name: 'Code Quality', weight: 20, description: 'Clean, readable, maintainable code with appropriate patterns' },
    { name: 'System Design', weight: 20, description: 'Architectural thinking, scalability considerations, trade-off analysis' },
    { name: 'Communication', weight: 15, description: 'Clear articulation of technical concepts and decisions' },
    { name: 'Technical Depth', weight: 20, description: 'Deep understanding of chosen technologies and their internals' },
  ],
  [
    { name: 'Algorithm Design', weight: 30, description: 'Correctness, efficiency, and edge-case handling' },
    { name: 'API Design', weight: 20, description: 'RESTful principles, error handling, documentation awareness' },
    { name: 'Testing Strategy', weight: 15, description: 'Test coverage approach, edge cases, integration vs unit tests' },
    { name: 'DevOps Awareness', weight: 15, description: 'CI/CD, containerization, deployment strategies' },
    { name: 'Collaboration', weight: 20, description: 'Code review skills, constructive feedback, teamwork signals' },
  ],
];

const CANDIDATE_NAMES = [
  'Alex Rivera', 'Jordan Chen', 'Sam Patel', 'Taylor Kim', 'Morgan Lee',
  'Casey Brooks', 'Jamie Santos', 'Riley Nakamura', 'Quinn Foster', 'Avery Williams',
  'Drew Martinez', 'Skyler Okafor', 'Reese Thompson', 'Blake Hoffman', 'Cameron Yee',
];

const CANDIDATE_EMAILS = CANDIDATE_NAMES.map(
  (n) => `${n.toLowerCase().replace(' ', '.')}@example.com`
);

// Assessment statuses used in mock data generation are defined inline in generateMockAssessments
const CANDIDATE_STATUSES: CandidateStatus[] = ['invited', 'in_progress', 'completed', 'scored', 'scored'];

function generateMockAssessments(): Assessment[] {
  const assessments: Assessment[] = [
    {
      id: assessmentId(),
      title: 'Senior Frontend Engineer',
      description: 'Full-stack assessment with focus on React, TypeScript, and component architecture. Candidates will participate in an adaptive interview and review a synthetic PR.',
      role: 'Senior Frontend Engineer',
      rubric: RUBRIC_TEMPLATES[0],
      config: { tech_stack: TECH_STACKS[0], interview_duration_minutes: 45, pr_review_enabled: true },
      status: 'active',
      created_by: 'recruiter@company.com',
      created_at: randomDate(14),
      updated_at: randomDate(7),
    },
    {
      id: assessmentId(),
      title: 'Backend Platform Engineer',
      description: 'Assessment for backend engineers working on distributed systems. Covers API design, system architecture, and operational excellence.',
      role: 'Backend Platform Engineer',
      rubric: RUBRIC_TEMPLATES[1],
      config: { tech_stack: TECH_STACKS[1], interview_duration_minutes: 60, pr_review_enabled: true },
      status: 'active',
      created_by: 'hiring-manager@company.com',
      created_at: randomDate(21),
      updated_at: randomDate(5),
    },
    {
      id: assessmentId(),
      title: 'Infrastructure Engineer',
      description: 'Cloud infrastructure and DevOps assessment. Evaluates Kubernetes, Terraform, and CI/CD pipeline design skills.',
      role: 'Infrastructure Engineer',
      rubric: RUBRIC_TEMPLATES[0],
      config: { tech_stack: TECH_STACKS[2], interview_duration_minutes: 45, pr_review_enabled: false },
      status: 'active',
      created_by: 'recruiter@company.com',
      created_at: randomDate(30),
      updated_at: randomDate(10),
    },
    {
      id: assessmentId(),
      title: 'Staff Java Engineer',
      description: 'Staff-level assessment for the payments platform team. Emphasis on system design, mentoring signals, and production incident handling.',
      role: 'Staff Java Engineer',
      rubric: RUBRIC_TEMPLATES[1],
      config: { tech_stack: TECH_STACKS[3], interview_duration_minutes: 60, pr_review_enabled: true },
      status: 'draft',
      created_by: 'recruiter@company.com',
      created_at: randomDate(3),
      updated_at: randomDate(1),
    },
    {
      id: assessmentId(),
      title: 'Systems Engineer (Rust)',
      description: 'Low-level systems programming assessment. Covers memory safety, concurrency patterns, and performance optimization.',
      role: 'Systems Engineer',
      rubric: RUBRIC_TEMPLATES[0],
      config: { tech_stack: TECH_STACKS[4], interview_duration_minutes: 50, pr_review_enabled: true },
      status: 'archived',
      created_by: 'hiring-manager@company.com',
      created_at: randomDate(60),
      updated_at: randomDate(30),
    },
  ];

  return assessments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function generateMockCandidates(assessments: Assessment[]): Candidate[] {
  const candidates: Candidate[] = [];
  let nameIdx = 0;

  for (const assessment of assessments) {
    if (assessment.status === 'draft') continue;
    const count = assessment.status === 'archived' ? 2 : 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count && nameIdx < CANDIDATE_NAMES.length; i++) {
      const status = CANDIDATE_STATUSES[Math.floor(Math.random() * CANDIDATE_STATUSES.length)];
      candidates.push({
        id: candidateId(),
        assessment_id: assessment.id,
        name: CANDIDATE_NAMES[nameIdx],
        email: CANDIDATE_EMAILS[nameIdx],
        status,
        metadata: { source: ['LinkedIn', 'Referral', 'Career Page', 'Agency'][Math.floor(Math.random() * 4)] },
        overall_score: status === 'scored' ? Math.round((60 + Math.random() * 35) * 100) / 100 : undefined,
        created_at: randomDate(14),
        updated_at: randomDate(3),
      });
      nameIdx++;
    }
  }

  return candidates;
}

function generateMockScores(candidates: Candidate[], assessments: Assessment[]): Score[] {
  return candidates
    .filter((c) => c.status === 'scored')
    .map((c) => {
      const assessment = assessments.find((a) => a.id === c.assessment_id);
      const rubric = assessment?.rubric ?? RUBRIC_TEMPLATES[0];
      const breakdown: Record<string, number> = {};
      for (const criterion of rubric) {
        breakdown[criterion.name] = Math.round((50 + Math.random() * 45) * 100) / 100;
      }
      return {
        id: `score_${Math.random().toString(36).substring(2, 10)}`,
        candidate_id: c.id,
        assessment_id: c.assessment_id,
        overall_score: c.overall_score ?? 75,
        breakdown,
        reasoning: `Candidate demonstrated strong ${rubric[0]?.name.toLowerCase() ?? 'technical'} skills. Showed good understanding of core concepts with room for growth in ${rubric[rubric.length - 1]?.name.toLowerCase() ?? 'advanced topics'}.`,
        scored_at: randomDate(2),
      };
    });
}

function generateMockInterviewSessions(candidates: Candidate[]): InterviewSession[] {
  return candidates
    .filter((c) => c.status === 'completed' || c.status === 'scored')
    .map((c) => {
      const messages: ConversationMessage[] = [
        { role: 'interviewer', content: "Welcome! Let's start by discussing your experience with distributed systems. Can you describe a challenging system you've built?", timestamp: randomDate(5) },
        { role: 'candidate', content: "Sure! At my previous company, I designed an event-driven microservices platform handling 50K events per second. We used Kafka for message passing and implemented saga patterns for distributed transactions.", timestamp: randomDate(5) },
        { role: 'interviewer', content: 'Interesting. How did you handle failure scenarios and ensure exactly-once processing?', timestamp: randomDate(5) },
        { role: 'candidate', content: 'We implemented idempotency keys at the consumer level and used Kafka\'s transactional API for atomic reads and writes. For saga rollbacks, each service published compensating events.', timestamp: randomDate(5) },
        { role: 'interviewer', content: "Good approach. Let's dive into the trade-offs. What were the main challenges with this architecture?", timestamp: randomDate(5) },
        { role: 'candidate', content: 'The biggest challenge was observability. With events flowing through multiple services, tracing a single request required distributed tracing with correlation IDs. We used OpenTelemetry and Jaeger for this.', timestamp: randomDate(5) },
      ];
      return {
        id: `sess_${Math.random().toString(36).substring(2, 10)}`,
        candidate_id: c.id,
        assessment_id: c.assessment_id,
        status: 'completed',
        conversation: messages,
        started_at: randomDate(5),
        completed_at: randomDate(3),
      };
    });
}

function generateMockPrExercises(candidates: Candidate[]): PrExercise[] {
  return candidates
    .filter((c) => c.status === 'completed' || c.status === 'scored')
    .map((c) => ({
      id: `pr_${Math.random().toString(36).substring(2, 10)}`,
      candidate_id: c.id,
      assessment_id: c.assessment_id,
      status: 'completed',
      generated_data: {
        title: 'Add rate limiting middleware to API gateway',
        description: 'Implements token-bucket rate limiting with Redis backing store. Adds per-user and per-IP limits with configurable windows.',
        diff: `--- a/src/middleware/rateLimit.ts\n+++ b/src/middleware/rateLimit.ts\n@@ -0,0 +1,45 @@\n+import { Redis } from 'ioredis';\n+import { Request, Response, NextFunction } from 'express';\n+\n+interface RateLimitConfig {\n+  windowMs: number;\n+  maxRequests: number;\n+}\n+\n+export function createRateLimiter(redis: Redis, config: RateLimitConfig) {\n+  return async (req: Request, res: Response, next: NextFunction) => {\n+    const key = \`rate:\${req.ip}\`;\n+    const current = await redis.incr(key);\n+    if (current === 1) {\n+      await redis.pexpire(key, config.windowMs);\n+    }\n+    if (current > config.maxRequests) {\n+      res.status(429).json({ error: 'Rate limit exceeded' });\n+      return;\n+    }\n+    next();\n+  };\n+}`,
      },
      submission: c.status === 'scored'
        ? {
            comments: [
              { line: 12, file: 'src/middleware/rateLimit.ts', body: 'Consider using a sliding window algorithm instead of fixed window to prevent burst traffic at window boundaries.', type: 'suggestion' as const },
              { line: 14, file: 'src/middleware/rateLimit.ts', body: 'Race condition: INCR and PEXPIRE are not atomic. Use a Lua script or MULTI/EXEC to ensure atomicity.', type: 'issue' as const },
              { line: 10, file: 'src/middleware/rateLimit.ts', body: 'Good use of TypeScript generics and clean interface definition.', type: 'praise' as const },
            ],
            summary: 'The rate limiting implementation has a solid foundation but needs atomic operations for the counter increment and expiry to prevent race conditions under high concurrency.',
          }
        : null,
      started_at: randomDate(5),
      completed_at: randomDate(3),
    }));
}

function generateMockBehavioralSignals(candidates: Candidate[]): BehavioralSignal[] {
  const signals: BehavioralSignal[] = [];
  for (const c of candidates.filter((c) => c.status !== 'invited')) {
    signals.push(
      {
        id: `sig_${Math.random().toString(36).substring(2, 10)}`,
        candidate_id: c.id,
        signal_type: 'response_time',
        data: { avg_ms: 2000 + Math.random() * 8000, median_ms: 1500 + Math.random() * 5000 },
        recorded_at: randomDate(5),
      },
      {
        id: `sig_${Math.random().toString(36).substring(2, 10)}`,
        candidate_id: c.id,
        signal_type: 'question_depth',
        data: { follow_up_ratio: Math.round(Math.random() * 100) / 100, clarifying_questions: Math.floor(Math.random() * 5) },
        recorded_at: randomDate(5),
      },
      {
        id: `sig_${Math.random().toString(36).substring(2, 10)}`,
        candidate_id: c.id,
        signal_type: 'code_review_thoroughness',
        data: { comments_per_file: 1 + Math.random() * 4, issue_detection_rate: Math.round(Math.random() * 100) / 100 },
        recorded_at: randomDate(5),
      },
    );
  }
  return signals;
}

// Initialize mock hiring data
const mockAssessments = generateMockAssessments();
const mockCandidates = generateMockCandidates(mockAssessments);
const mockScores = generateMockScores(mockCandidates, mockAssessments);
const mockInterviewSessions = generateMockInterviewSessions(mockCandidates);
const mockPrExercises = generateMockPrExercises(mockCandidates);
const mockBehavioralSignals = generateMockBehavioralSignals(mockCandidates);

// Hiring Portal API Functions

export async function fetchAssessments(): Promise<Assessment[]> {
  await delay(400 + Math.random() * 300);
  return [...mockAssessments];
}

export async function fetchAssessment(id: string): Promise<Assessment | null> {
  await delay(250 + Math.random() * 200);
  return mockAssessments.find((a) => a.id === id) ?? null;
}

export async function createAssessment(request: CreateAssessmentRequest): Promise<Assessment> {
  await delay(500 + Math.random() * 300);
  const now = new Date().toISOString();
  const assessment: Assessment = {
    id: assessmentId(),
    title: request.title,
    description: request.description || null,
    role: request.role,
    rubric: RUBRIC_TEMPLATES[0],
    config: {
      tech_stack: request.tech_stack || [],
      interview_duration_minutes: 45,
      pr_review_enabled: true,
    },
    status: 'draft',
    created_by: 'recruiter@company.com',
    created_at: now,
    updated_at: now,
  };
  mockAssessments.unshift(assessment);
  return assessment;
}

export async function fetchCandidatesForAssessment(assessmentId: string): Promise<Candidate[]> {
  await delay(300 + Math.random() * 200);
  return mockCandidates.filter((c) => c.assessment_id === assessmentId);
}

export async function fetchCandidate(id: string): Promise<Candidate | null> {
  await delay(250 + Math.random() * 200);
  return mockCandidates.find((c) => c.id === id) ?? null;
}

export async function fetchScoreForCandidate(candidateId: string): Promise<Score | null> {
  await delay(200 + Math.random() * 150);
  return mockScores.find((s) => s.candidate_id === candidateId) ?? null;
}

export async function fetchInterviewSession(candidateId: string): Promise<InterviewSession | null> {
  await delay(200 + Math.random() * 150);
  return mockInterviewSessions.find((s) => s.candidate_id === candidateId) ?? null;
}

export async function fetchPrExercise(candidateId: string): Promise<PrExercise | null> {
  await delay(200 + Math.random() * 150);
  return mockPrExercises.find((p) => p.candidate_id === candidateId) ?? null;
}

export async function fetchBehavioralSignals(candidateId: string): Promise<BehavioralSignal[]> {
  await delay(200 + Math.random() * 150);
  return mockBehavioralSignals.filter((s) => s.candidate_id === candidateId);
}
