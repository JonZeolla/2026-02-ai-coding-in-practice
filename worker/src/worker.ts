import { Worker, QueueEvents } from "bullmq";
import { Pool } from "pg";
import { config } from "./config";
import { createProcessor, JobData } from "./processor";

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

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
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
