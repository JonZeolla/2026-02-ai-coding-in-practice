import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Pool } from "pg";

const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as unknown as Pool;

vi.mock("../src/db", () => ({
  getPool: () => mockPool,
  setPool: vi.fn(),
  closePool: vi.fn(),
}));

import candidateRoutes from "../src/routes/candidates";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(candidateRoutes);
  return app;
}

describe("GET /api/candidate/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return candidate and assessment info with header token", async () => {
    const candidate = {
      id: "candidate-1",
      assessment_id: "assess-1",
      name: "Jane Doe",
      email: "jane@example.com",
      status: "invited",
    };
    const assessment = {
      id: "assess-1",
      title: "Engineer Assessment",
      description: "Test assessment",
      role: "Engineer",
      config: {},
      status: "active",
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] })
      .mockResolvedValueOnce({ rows: [assessment] });

    const app = createApp();
    const response = await request(app)
      .get("/api/candidate/session")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      candidate: {
        id: "candidate-1",
        name: "Jane Doe",
        email: "jane@example.com",
        status: "invited",
      },
      assessment,
    });
  });

  it("should accept token via query parameter", async () => {
    const candidate = {
      id: "candidate-1",
      assessment_id: "assess-1",
      name: "Jane Doe",
      email: "jane@example.com",
      status: "invited",
    };
    const assessment = {
      id: "assess-1",
      title: "Test",
      description: null,
      role: "Engineer",
      config: {},
      status: "active",
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] })
      .mockResolvedValueOnce({ rows: [assessment] });

    const app = createApp();
    const response = await request(app)
      .get("/api/candidate/session?token=valid-token");

    expect(response.status).toBe(200);
    expect(response.body.candidate.id).toBe("candidate-1");
  });

  it("should return 401 when no token provided", async () => {
    const app = createApp();
    const response = await request(app).get("/api/candidate/session");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Missing candidate token");
  });

  it("should return 401 when token is invalid", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app)
      .get("/api/candidate/session")
      .set("X-Candidate-Token", "invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid candidate token");
  });

  it("should return 404 when assessment not found", async () => {
    const candidate = {
      id: "candidate-1",
      assessment_id: "missing-assess",
      name: "Jane Doe",
      email: "jane@example.com",
      status: "invited",
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app)
      .get("/api/candidate/session")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Assessment not found");
  });

  it("should return 500 on database error in auth", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = createApp();
    const response = await request(app)
      .get("/api/candidate/session")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });

  it("should return 500 on database error in session handler", async () => {
    const candidate = {
      id: "candidate-1",
      assessment_id: "assess-1",
      name: "Jane Doe",
      email: "jane@example.com",
      status: "invited",
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] })
      .mockRejectedValueOnce(new Error("DB error"));

    const app = createApp();
    const response = await request(app)
      .get("/api/candidate/session")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });
});
