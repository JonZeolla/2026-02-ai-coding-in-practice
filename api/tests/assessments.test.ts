import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Pool } from "pg";

vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

vi.mock("crypto", () => ({
  default: {
    randomBytes: () => ({
      toString: () => "abc123tokenvalue",
    }),
  },
  randomBytes: () => ({
    toString: () => "abc123tokenvalue",
  }),
}));

const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as unknown as Pool;

vi.mock("../src/db", () => ({
  getPool: () => mockPool,
  setPool: vi.fn(),
  closePool: vi.fn(),
}));

import assessmentRoutes from "../src/routes/assessments";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(assessmentRoutes);
  return app;
}

describe("POST /api/assessments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it("should create an assessment with valid input", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/assessments")
      .send({
        title: "Senior Engineer Assessment",
        role: "Senior Software Engineer",
        rubric: { coding: 40, design: 30, communication: 30 },
        config: { duration_minutes: 60 },
        created_by: "recruiter@company.com",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "test-uuid-1234",
      title: "Senior Engineer Assessment",
      description: null,
      role: "Senior Software Engineer",
      rubric: { coding: 40, design: 30, communication: 30 },
      config: { duration_minutes: 60 },
      status: "draft",
      created_by: "recruiter@company.com",
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO assessments"),
      [
        "test-uuid-1234",
        "Senior Engineer Assessment",
        null,
        "Senior Software Engineer",
        JSON.stringify({ coding: 40, design: 30, communication: 30 }),
        JSON.stringify({ duration_minutes: 60 }),
        "recruiter@company.com",
      ]
    );
  });

  it("should create an assessment with defaults for optional fields", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/assessments")
      .send({ title: "Basic Test", role: "Junior Engineer" });

    expect(response.status).toBe(201);
    expect(response.body.rubric).toEqual({});
    expect(response.body.config).toEqual({});
    expect(response.body.created_by).toBeNull();
  });

  it("should return 400 when title is missing", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/assessments")
      .send({ role: "Engineer" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("title");
  });

  it("should return 400 when role is missing", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/assessments")
      .send({ title: "Test" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("role");
  });

  it("should return 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const app = createApp();
    const response = await request(app)
      .post("/api/assessments")
      .send({ title: "Test", role: "Engineer" });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });
});

describe("GET /api/assessments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list all assessments", async () => {
    const assessments = [
      { id: "1", title: "Test 1", role: "Engineer", status: "draft" },
      { id: "2", title: "Test 2", role: "Manager", status: "active" },
    ];
    mockQuery.mockResolvedValueOnce({ rows: assessments });

    const app = createApp();
    const response = await request(app).get("/api/assessments");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(assessments);
  });

  it("should filter assessments by status", async () => {
    const assessments = [{ id: "1", title: "Test", role: "Engineer", status: "draft" }];
    mockQuery.mockResolvedValueOnce({ rows: assessments });

    const app = createApp();
    const response = await request(app).get("/api/assessments?status=draft");

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = $1"),
      ["draft"]
    );
  });

  it("should return 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = createApp();
    const response = await request(app).get("/api/assessments");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });
});

describe("GET /api/assessments/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an assessment by id", async () => {
    const assessment = { id: "abc-123", title: "Test", role: "Engineer", status: "draft" };
    mockQuery.mockResolvedValueOnce({ rows: [assessment] });

    const app = createApp();
    const response = await request(app).get("/api/assessments/abc-123");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(assessment);
  });

  it("should return 404 when assessment not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app).get("/api/assessments/nonexistent");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Assessment not found");
  });

  it("should return 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = createApp();
    const response = await request(app).get("/api/assessments/abc-123");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });
});

describe("POST /api/assessments/:id/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should invite a candidate with valid input", async () => {
    // First query: assessment lookup, second: candidate insert
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "assessment-1" }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const app = createApp();
    const response = await request(app)
      .post("/api/assessments/assessment-1/invite")
      .send({
        name: "Jane Doe",
        email: "jane@example.com",
        metadata: { source: "linkedin" },
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "test-uuid-1234",
      assessment_id: "assessment-1",
      name: "Jane Doe",
      email: "jane@example.com",
      access_token: "abc123tokenvalue",
      status: "invited",
      metadata: { source: "linkedin" },
    });
  });

  it("should return 404 when assessment does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app)
      .post("/api/assessments/nonexistent/invite")
      .send({ name: "Jane", email: "jane@example.com" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Assessment not found");
  });

  it("should return 400 when name is missing", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/assessments/assessment-1/invite")
      .send({ email: "jane@example.com" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("name");
  });

  it("should return 400 when email is missing", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/assessments/assessment-1/invite")
      .send({ name: "Jane" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("email");
  });

  it("should return 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const app = createApp();
    const response = await request(app)
      .post("/api/assessments/assessment-1/invite")
      .send({ name: "Jane", email: "jane@example.com" });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });
});
