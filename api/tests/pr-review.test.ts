import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Pool } from "pg";

// Mock uuid to return predictable values
vi.mock("uuid", () => ({
  v4: () => "test-uuid",
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

import prReviewRoutes from "../src/routes/pr-review";

const candidateToken = "valid-token-123";

const mockCandidate = {
  id: "cand-1",
  assessment_id: "assess-1",
  name: "Test Candidate",
  email: "test@example.com",
  status: "in_progress",
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(prReviewRoutes);
  return app;
}

function withAuth(req: request.Test): request.Test {
  return req.set("x-candidate-token", candidateToken);
}

function mockCandidateAuth() {
  mockQuery.mockResolvedValueOnce({ rows: [mockCandidate] });
}

describe("POST /api/candidate/pr-review/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 without token", async () => {
    const app = createApp();
    const res = await request(app).post("/api/candidate/pr-review/start");
    expect(res.status).toBe(401);
  });

  it("should return existing exercise if one exists", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "ex-existing", status: "ready", generated_data: {}, created_at: new Date() }],
    });

    const app = createApp();
    const res = await withAuth(
      request(app).post("/api/candidate/pr-review/start")
    );

    expect(res.status).toBe(200);
    expect(res.body.exerciseId).toBe("ex-existing");
    expect(res.body.status).toBe("ready");
  });

  it("should create new exercise and queue job when none exists", async () => {
    mockCandidateAuth();
    // No existing exercise
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Insert pr_exercises
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // Insert jobs
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const app = createApp();
    const res = await withAuth(
      request(app).post("/api/candidate/pr-review/start")
    );

    expect(res.status).toBe(201);
    expect(res.body.exerciseId).toBe("test-uuid");
    expect(res.body.status).toBe("generating");
    expect(mockAdd).toHaveBeenCalledWith(
      "pr.generate",
      expect.objectContaining({
        assessmentId: "assess-1",
        candidateId: "cand-1",
        exerciseId: "test-uuid",
      }),
      expect.any(Object)
    );
  });
});

describe("GET /api/candidate/pr-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 without token", async () => {
    const app = createApp();
    const res = await request(app).get("/api/candidate/pr-review");
    expect(res.status).toBe(401);
  });

  it("should return 404 when no exercise exists", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await withAuth(
      request(app).get("/api/candidate/pr-review")
    );

    expect(res.status).toBe(404);
  });

  it("should return PR data without internal issues", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "ex-1",
        status: "ready",
        generated_data: {
          title: "Add feature",
          description: "PR description",
          files: [{ path: "src/index.ts", content: "code" }],
          issues: [{ file: "src/index.ts", line: 1, category: "bug" }],
        },
        submission: null,
        started_at: new Date(),
        created_at: new Date(),
      }],
    });

    const app = createApp();
    const res = await withAuth(
      request(app).get("/api/candidate/pr-review")
    );

    expect(res.status).toBe(200);
    expect(res.body.pr.title).toBe("Add feature");
    expect(res.body.pr.files).toBeDefined();
    // Internal issues should NOT be exposed to candidate
    expect(res.body.pr.issues).toBeUndefined();
  });

  it("should return null pr when status is generating", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "ex-1",
        status: "generating",
        generated_data: {},
        submission: null,
        started_at: new Date(),
        created_at: new Date(),
      }],
    });

    const app = createApp();
    const res = await withAuth(
      request(app).get("/api/candidate/pr-review")
    );

    expect(res.status).toBe(200);
    expect(res.body.pr).toBeNull();
    expect(res.body.status).toBe("generating");
  });
});

describe("POST /api/candidate/pr-review/comment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 without token", async () => {
    const app = createApp();
    const res = await request(app).post("/api/candidate/pr-review/comment");
    expect(res.status).toBe(401);
  });

  it("should return 400 when fields are missing", async () => {
    mockCandidateAuth();

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/pr-review/comment")
        .send({ file: "test.ts" })
    );

    expect(res.status).toBe(400);
  });

  it("should add comment to existing exercise", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "ex-1",
        status: "ready",
        submission: null,
      }],
    });
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/pr-review/comment")
        .send({ file: "src/index.ts", line: 10, comment: "This looks wrong" })
    );

    expect(res.status).toBe(201);
    expect(res.body.totalComments).toBe(1);
  });

  it("should reject comment on submitted exercise", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "ex-1", status: "submitted", submission: { comments: [] } }],
    });

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/pr-review/comment")
        .send({ file: "src/index.ts", line: 10, comment: "Too late" })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("already submitted");
  });

  it("should reject comment when exercise is not ready", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "ex-1", status: "generating", submission: null }],
    });

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/pr-review/comment")
        .send({ file: "src/index.ts", line: 10, comment: "Not ready" })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not ready");
  });
});

describe("POST /api/candidate/pr-review/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 without token", async () => {
    const app = createApp();
    const res = await request(app).post("/api/candidate/pr-review/submit");
    expect(res.status).toBe(401);
  });

  it("should submit review with comments", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "ex-1",
        status: "ready",
        submission: { comments: [{ id: "c1", file: "test.ts", line: 1, comment: "Bug" }] },
      }],
    });
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const app = createApp();
    const res = await withAuth(
      request(app).post("/api/candidate/pr-review/submit")
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("submitted");
    expect(res.body.totalComments).toBe(1);
  });

  it("should reject submission with no comments", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "ex-1", status: "ready", submission: null }],
    });

    const app = createApp();
    const res = await withAuth(
      request(app).post("/api/candidate/pr-review/submit")
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("no comments");
  });

  it("should reject double submission", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "ex-1", status: "submitted", submission: { comments: [] } }],
    });

    const app = createApp();
    const res = await withAuth(
      request(app).post("/api/candidate/pr-review/submit")
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("already submitted");
  });

  it("should reject submission when exercise is not ready", async () => {
    mockCandidateAuth();
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "ex-1", status: "generating", submission: null }],
    });

    const app = createApp();
    const res = await withAuth(
      request(app).post("/api/candidate/pr-review/submit")
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not ready");
  });
});
