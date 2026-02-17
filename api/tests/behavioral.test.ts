import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Pool } from "pg";

// Mock uuid to return predictable values
let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// Mock pg
const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as unknown as Pool;

vi.mock("../src/db", () => ({
  getPool: () => mockPool,
  setPool: vi.fn(),
  closePool: vi.fn(),
}));

import behavioralRoutes from "../src/routes/behavioral";

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
  app.use(behavioralRoutes);
  return app;
}

function withAuth(req: request.Test): request.Test {
  return req.set("x-candidate-token", candidateToken);
}

function mockCandidateAuth() {
  mockQuery.mockResolvedValueOnce({ rows: [mockCandidate] });
}

describe("POST /api/candidate/behavioral", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("should return 401 without token", async () => {
    const app = createApp();
    const res = await request(app).post("/api/candidate/behavioral");
    expect(res.status).toBe(401);
  });

  it("should return 400 when signalType is missing", async () => {
    mockCandidateAuth();

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral")
        .send({ data: { wpm: 65 } })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("signalType");
  });

  it("should return 400 for invalid signalType", async () => {
    mockCandidateAuth();

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral")
        .send({ signalType: "invalid_type", data: { wpm: 65 } })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid signalType");
  });

  it("should return 400 when data is missing", async () => {
    mockCandidateAuth();

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral")
        .send({ signalType: "typing_rhythm" })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("data");
  });

  it("should return 400 when data is an array", async () => {
    mockCandidateAuth();

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral")
        .send({ signalType: "typing_rhythm", data: [1, 2, 3] })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("data");
  });

  it("should return 400 for invalid sessionId", async () => {
    mockCandidateAuth();
    // sessionId check returns no rows
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral")
        .send({ signalType: "typing_rhythm", data: { wpm: 65 }, sessionId: "bad-session" })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid sessionId");
  });

  it("should record a behavioral signal successfully", async () => {
    mockCandidateAuth();
    // Insert signal
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // Count query
    mockQuery.mockResolvedValueOnce({ rows: [{ total: "5" }] });

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral")
        .send({
          signalType: "typing_rhythm",
          data: { wpm: 65, consistency: 0.8 },
        })
    );

    expect(res.status).toBe(201);
    expect(res.body.signalId).toBeDefined();
    expect(res.body.signalType).toBe("typing_rhythm");
    expect(res.body.totalSignals).toBe(5);
  });

  it("should record signal with valid sessionId", async () => {
    mockCandidateAuth();
    // sessionId check
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "session-1" }] });
    // Insert signal
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // Count query
    mockQuery.mockResolvedValueOnce({ rows: [{ total: "1" }] });

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral")
        .send({
          signalType: "response_timing",
          data: { responseMs: 3200 },
          sessionId: "session-1",
        })
    );

    expect(res.status).toBe(201);
    expect(res.body.signalType).toBe("response_timing");
  });

  it("should accept all valid signal types", async () => {
    const validTypes = [
      "typing_rhythm",
      "paste_detection",
      "tab_focus",
      "response_timing",
      "navigation",
      "interaction",
    ];

    for (const signalType of validTypes) {
      vi.clearAllMocks();
      uuidCounter = 0;
      mockCandidateAuth();
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [{ total: "1" }] });

      const app = createApp();
      const res = await withAuth(
        request(app)
          .post("/api/candidate/behavioral")
          .send({ signalType, data: { value: true } })
      );

      expect(res.status).toBe(201);
    }
  });
});

describe("POST /api/candidate/behavioral/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it("should return 401 without token", async () => {
    const app = createApp();
    const res = await request(app).post("/api/candidate/behavioral/batch");
    expect(res.status).toBe(401);
  });

  it("should return 400 when signals is not an array", async () => {
    mockCandidateAuth();

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral/batch")
        .send({ signals: "not-an-array" })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("signals");
  });

  it("should return 400 when signals is empty", async () => {
    mockCandidateAuth();

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral/batch")
        .send({ signals: [] })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("non-empty array");
  });

  it("should return 400 when a signal has invalid type", async () => {
    mockCandidateAuth();

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral/batch")
        .send({
          signals: [
            { signalType: "typing_rhythm", data: { wpm: 65 } },
            { signalType: "invalid_type", data: { value: true } },
          ],
        })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("index 1");
  });

  it("should insert multiple signals successfully", async () => {
    mockCandidateAuth();
    // Two inserts
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral/batch")
        .send({
          signals: [
            { signalType: "typing_rhythm", data: { wpm: 65 } },
            { signalType: "tab_focus", data: { focused: false, duration: 5000 } },
          ],
        })
    );

    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(2);
    expect(res.body.signalIds).toHaveLength(2);
  });

  it("should return 400 when batch exceeds 100 signals", async () => {
    mockCandidateAuth();

    const signals = Array.from({ length: 101 }, () => ({
      signalType: "typing_rhythm",
      data: { wpm: 65 },
    }));

    const app = createApp();
    const res = await withAuth(
      request(app)
        .post("/api/candidate/behavioral/batch")
        .send({ signals })
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Maximum 100");
  });
});
