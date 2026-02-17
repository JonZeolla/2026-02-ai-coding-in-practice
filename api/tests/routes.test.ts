import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Pool } from "pg";

// Mock uuid to return predictable values
vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

// Mock pg
const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as unknown as Pool;

vi.mock("../src/db", () => ({
  getPool: () => mockPool,
  setPool: vi.fn(),
  closePool: vi.fn(),
}));

// Mock bullmq
const mockAdd = vi.fn().mockResolvedValue({});
const mockQueue = { add: mockAdd, close: vi.fn() };

vi.mock("../src/queue", () => ({
  getQueue: () => mockQueue,
  setQueue: vi.fn(),
  closeQueue: vi.fn(),
}));

import routes from "../src/routes";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(routes);
  return app;
}

describe("POST /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    mockAdd.mockResolvedValue({});
  });

  it("should create a job with valid input", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/jobs")
      .send({ type: "email.send", payload: { to: "user@test.com" } });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "test-uuid-1234",
      type: "email.send",
      status: "pending",
      payload: { to: "user@test.com" },
    });

    // Verify DB insert was called
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO jobs"),
      ["test-uuid-1234", "email.send", JSON.stringify({ to: "user@test.com" })]
    );

    // Verify job was added to queue
    expect(mockAdd).toHaveBeenCalledWith(
      "email.send",
      { jobId: "test-uuid-1234", to: "user@test.com" },
      { jobId: "test-uuid-1234" }
    );
  });

  it("should create a job with default empty payload", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/jobs")
      .send({ type: "report.generate" });

    expect(response.status).toBe(201);
    expect(response.body.payload).toEqual({});
  });

  it("should return 400 when type is missing", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/jobs")
      .send({ payload: { data: "test" } });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("type");
  });

  it("should return 400 when type is not a string", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/jobs")
      .send({ type: 123 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("type");
  });

  it("should return 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection failed"));
    const app = createApp();
    const response = await request(app)
      .post("/api/jobs")
      .send({ type: "email.send" });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });
});

describe("GET /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list all jobs", async () => {
    const jobs = [
      { id: "1", type: "email.send", status: "pending", payload: {} },
      { id: "2", type: "report.generate", status: "completed", payload: {} },
    ];
    mockQuery.mockResolvedValueOnce({ rows: jobs });

    const app = createApp();
    const response = await request(app).get("/api/jobs");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(jobs);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT * FROM jobs"),
      []
    );
  });

  it("should filter jobs by status", async () => {
    const jobs = [{ id: "1", type: "email.send", status: "pending", payload: {} }];
    mockQuery.mockResolvedValueOnce({ rows: jobs });

    const app = createApp();
    const response = await request(app).get("/api/jobs?status=pending");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(jobs);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = $1"),
      ["pending"]
    );
  });

  it("should return empty array when no jobs exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app).get("/api/jobs");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("should return 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = createApp();
    const response = await request(app).get("/api/jobs");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });
});

describe("GET /api/jobs/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a job by id", async () => {
    const job = {
      id: "abc-123",
      type: "email.send",
      status: "completed",
      payload: { to: "user@test.com" },
      result: { sent: true },
    };
    mockQuery.mockResolvedValueOnce({ rows: [job] });

    const app = createApp();
    const response = await request(app).get("/api/jobs/abc-123");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(job);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT * FROM jobs WHERE id = $1"),
      ["abc-123"]
    );
  });

  it("should return 404 when job not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app).get("/api/jobs/nonexistent");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Job not found");
  });

  it("should return 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = createApp();
    const response = await request(app).get("/api/jobs/abc-123");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });
});
