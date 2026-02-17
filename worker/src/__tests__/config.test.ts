import { describe, it, expect, vi, afterEach } from "vitest";

describe("config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("should use default values when env vars are not set", async () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_DB;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.WORKER_CONCURRENCY;
    delete process.env.QUEUE_NAME;

    const { config } = await import("../config");

    expect(config.redis.host).toBe("localhost");
    expect(config.redis.port).toBe(6379);
    expect(config.postgres.host).toBe("localhost");
    expect(config.postgres.port).toBe(5432);
    expect(config.postgres.database).toBe("jobqueue");
    expect(config.postgres.user).toBe("jobqueue");
    expect(config.postgres.password).toBe("jobqueue_dev");
    expect(config.worker.concurrency).toBe(5);
    expect(config.worker.queueName).toBe("jobs");
  });

  it("should use environment variables when set", async () => {
    process.env.REDIS_HOST = "redis-server";
    process.env.REDIS_PORT = "6380";
    process.env.POSTGRES_HOST = "pg-server";
    process.env.POSTGRES_PORT = "5433";
    process.env.POSTGRES_DB = "mydb";
    process.env.POSTGRES_USER = "myuser";
    process.env.POSTGRES_PASSWORD = "mypass";
    process.env.WORKER_CONCURRENCY = "10";
    process.env.QUEUE_NAME = "custom-queue";

    const { config } = await import("../config");

    expect(config.redis.host).toBe("redis-server");
    expect(config.redis.port).toBe(6380);
    expect(config.postgres.host).toBe("pg-server");
    expect(config.postgres.port).toBe(5433);
    expect(config.postgres.database).toBe("mydb");
    expect(config.postgres.user).toBe("myuser");
    expect(config.postgres.password).toBe("mypass");
    expect(config.worker.concurrency).toBe(10);
    expect(config.worker.queueName).toBe("custom-queue");
  });
});
