import { Job } from "bullmq";
import { Pool } from "pg";
import { markJobRunning, markJobCompleted, markJobFailed } from "./db";
import { handleRubricGenerate } from "./handlers/rubric";
import { handlePrGenerate } from "./handlers/pr-generate";

export interface JobData {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProcessResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export type JobHandler = (
  payload: Record<string, unknown>,
  pool: Pool
) => Promise<ProcessResult>;

const handlers: Record<string, JobHandler> = {
  "rubric.generate": handleRubricGenerate,
  "pr.generate": handlePrGenerate,
};

export function registerHandler(type: string, handler: JobHandler): void {
  handlers[type] = handler;
}

export function getHandler(type: string): JobHandler | undefined {
  return handlers[type];
}

async function dispatch(
  type: string,
  payload: Record<string, unknown>,
  pool: Pool
): Promise<ProcessResult> {
  const handler = handlers[type];
  if (!handler) {
    return {
      success: false,
      error: `No handler registered for job type: ${type}`,
    };
  }
  return handler(payload, pool);
}

/**
 * Main job processor function used by the BullMQ Worker.
 * Dispatches to type-specific handlers based on the job type.
 */
export function createProcessor(pool: Pool) {
  return async function processJob(job: Job<JobData>): Promise<void> {
    const jobId = job.data.jobId;
    const type = job.data.type ?? job.name;
    const payload = job.data.payload ?? job.data;

    try {
      await markJobRunning(pool, jobId);

      const result = await dispatch(type, payload, pool);

      if (result.success) {
        await markJobCompleted(pool, jobId, result.data!);
      } else {
        await markJobFailed(pool, jobId, result.error!);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Unhandled error processing job ${jobId}:`, message);
      try {
        await markJobFailed(pool, jobId, message);
      } catch (dbErr) {
        console.error(`Failed to mark job ${jobId} as failed in DB:`, dbErr);
      }
      throw err;
    }
  };
}
