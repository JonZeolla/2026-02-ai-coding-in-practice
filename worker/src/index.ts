import { createPool } from "./db";
import { createWorker } from "./worker";
import { config } from "./config";

async function main() {
  console.log("Starting job queue worker...");
  console.log(`Queue: ${config.worker.queueName}`);
  console.log(`Concurrency: ${config.worker.concurrency}`);
  console.log(`Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`PostgreSQL: ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`);

  const pool = createPool();
  const { worker, shutdown } = createWorker(pool);

  const handleSignal = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    await shutdown();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => handleSignal("SIGINT"));
  process.on("SIGTERM", () => handleSignal("SIGTERM"));

  console.log("Worker is running. Waiting for jobs...");

  // Keep process alive
  await worker.waitUntilReady();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
