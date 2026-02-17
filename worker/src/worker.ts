import { Worker, QueueEvents } from "bullmq";
import { Pool } from "pg";
import { config } from "./config";
import { createProcessor, JobData } from "./processor";
import { markJobFailed, getJob } from "./db";

export interface WorkerInstance {
  worker: Worker<JobData>;
  queueEvents: QueueEvents;
  pool: Pool;
  shutdown: () => Promise<void>;
}

export function createWorker(
  pool: Pool,
  options?: { concurrency?: number; delayMs?: number }
): WorkerInstance {
  const concurrency = options?.concurrency ?? config.worker.concurrency;
  const processor = createProcessor(pool, options?.delayMs);

  const worker = new Worker<JobData>(config.worker.queueName, processor, {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
    },
    concurrency,
  });

  const queueEvents = new QueueEvents(config.worker.queueName, {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
    },
  });

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
    if (job?.data?.jobId) {
      try {
        const existing = await getJob(pool, job.data.jobId);
        if (existing && existing.status !== "failed") {
          await markJobFailed(pool, job.data.jobId, err.message);
        }
      } catch (dbErr) {
        console.error(`Failed to update job ${job.data.jobId} status in DB:`, dbErr);
      }
    }
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
  });

  const shutdown = async () => {
    await worker.close();
    await queueEvents.close();
  };

  return { worker, queueEvents, pool, shutdown };
}
