const pgHost = process.env.POSTGRES_HOST || "localhost";

export const config = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },
  postgres: {
    host: pgHost,
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    database: process.env.POSTGRES_DB || "jobqueue",
    user: process.env.POSTGRES_USER || "jobqueue",
    password: process.env.POSTGRES_PASSWORD || "jobqueue_dev",
    ...(pgHost !== "localhost" && { ssl: { rejectUnauthorized: false } }),
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5", 10),
    queueName: process.env.QUEUE_NAME || "jobs",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  },
};
