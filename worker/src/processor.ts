import { Job } from "bullmq";
import { Pool } from "pg";
import { markJobRunning, markJobCompleted, markJobFailed } from "./db";

export interface JobData {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface ProcessResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Simulate processing work with a configurable delay.
 * In production, this would dispatch to type-specific handlers.
 */
export async function simulateWork(
  type: string,
  payload: Record<string, unknown>,
  delayMs: number = 500
): Promise<ProcessResult> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  // Simulate failure for jobs with type "fail" or payload.shouldFail
  if (type === "fail" || payload.shouldFail) {
    return {
      success: false,
      error: `Simulated failure for job type: ${type}`,
    };
  }

  return {
    success: true,
    data: {
      processedAt: new Date().toISOString(),
      inputType: type,
      summary: `Processed ${type} job successfully`,
    },
  };
}

/**
 * Main job processor function used by the BullMQ Worker.
 * Marks the job as running in PostgreSQL, processes it, then updates with results.
 */
export function createProcessor(pool: Pool, delayMs?: number) {
  return async function processJob(job: Job<JobData>): Promise<void> {
    const { jobId, type, payload } = job.data;

    try {
      // Mark as running in PostgreSQL
      await markJobRunning(pool, jobId);

      // Process the job
      const result = await simulateWork(type, payload, delayMs);

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
