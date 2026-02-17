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

const mockCreate = vi.fn();

vi.mock("../src/claude", () => ({
  getClaudeClient: () => ({
    messages: { create: mockCreate },
  }),
  getModel: () => "claude-sonnet-4-20250514",
  resetClaudeClient: vi.fn(),
}));

import interviewRoutes from "../src/routes/interview";

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
  role: "Senior Engineer",
  description: "Test assessment",
  rubric: { criteria: [{ name: "Problem Solving", description: "Test", weight: 0.5, levels: [] }] },
  config: { tech_stack: ["TypeScript", "Node.js"] },
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(interviewRoutes);
  return app;
}

describe("POST /api/candidate/interview/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create interview session and return first question", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [] }) // no existing session
      .mockResolvedValueOnce({ rows: [assessment] }) // fetch assessment
      .mockResolvedValueOnce({ rows: [{ id: "session-1", status: "in_progress", started_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" }] }) // insert session
      .mockResolvedValueOnce({ rows: [] }); // update candidate status

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Tell me about your experience with TypeScript." }],
    });

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/start")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(201);
    expect(response.body.sessionId).toBe("session-1");
    expect(response.body.status).toBe("in_progress");
    expect(response.body.question).toBe("Tell me about your experience with TypeScript.");
    expect(response.body.questionNumber).toBe(1);
    expect(response.body.totalQuestions).toBe(8);
  });

  it("should return 409 if session already exists", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [{ id: "session-existing", status: "in_progress" }] }); // existing session

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/start")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Interview session already exists");
    expect(response.body.sessionId).toBe("session-existing");
  });

  it("should return 404 if assessment not found", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [] }) // no existing session
      .mockResolvedValueOnce({ rows: [] }); // no assessment

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/start")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Assessment not found");
  });

  it("should return 502 if Claude returns no text", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [] }) // no existing session
      .mockResolvedValueOnce({ rows: [assessment] }); // fetch assessment

    mockCreate.mockResolvedValueOnce({ content: [] });

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/start")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(502);
    expect(response.body.error).toBe("Failed to generate interview question");
  });

  it("should return 401 without token", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/start");

    expect(response.status).toBe(401);
  });
});

describe("POST /api/candidate/interview/answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const activeSession = {
    id: "session-1",
    status: "in_progress",
    conversation: [
      { role: "interviewer", content: "Q1?", questionNumber: 1, timestamp: "2026-01-01T00:00:00Z" },
    ],
    context: {
      techStack: ["TypeScript"],
      rubric: { criteria: [] },
      role: "Engineer",
      totalQuestions: 8,
      currentQuestion: 1,
    },
  };

  it("should accept answer and return next question", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [activeSession] }) // get session
      .mockResolvedValueOnce({ rows: [] }); // update session

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Follow-up question about design patterns?" }],
    });

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/answer")
      .set("X-Candidate-Token", "valid-token")
      .send({ answer: "I have 5 years of TypeScript experience." });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("in_progress");
    expect(response.body.question).toBe("Follow-up question about design patterns?");
    expect(response.body.questionNumber).toBe(2);
  });

  it("should complete interview after last answer", async () => {
    const finalSession = {
      ...activeSession,
      context: { ...activeSession.context, currentQuestion: 8 },
      conversation: [
        { role: "interviewer", content: "Last Q?", questionNumber: 8, timestamp: "2026-01-01T00:00:00Z" },
      ],
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [finalSession] }) // get session
      .mockResolvedValueOnce({ rows: [] }) // update session (completed)
      .mockResolvedValueOnce({ rows: [] }); // update candidate

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/answer")
      .set("X-Candidate-Token", "valid-token")
      .send({ answer: "My final answer." });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(response.body.message).toContain("Interview complete");
    expect(response.body.question).toBeUndefined();
  });

  it("should return 400 if answer is missing", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [candidate] }); // candidateAuth

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/answer")
      .set("X-Candidate-Token", "valid-token")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Answer is required");
  });

  it("should return 400 if answer is empty string", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [candidate] }); // candidateAuth

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/answer")
      .set("X-Candidate-Token", "valid-token")
      .send({ answer: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Answer is required");
  });

  it("should return 404 if no active session", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [] }); // no session

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/answer")
      .set("X-Candidate-Token", "valid-token")
      .send({ answer: "Some answer" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("No active interview session found");
  });

  it("should return 502 if Claude fails on follow-up", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [activeSession] }); // get session

    mockCreate.mockResolvedValueOnce({ content: [] });

    const app = createApp();
    const response = await request(app)
      .post("/api/candidate/interview/answer")
      .set("X-Candidate-Token", "valid-token")
      .send({ answer: "My answer" });

    expect(response.status).toBe(502);
    expect(response.body.error).toBe("Failed to generate next question");
  });
});

describe("GET /api/candidate/interview/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return session status when session exists", async () => {
    const session = {
      id: "session-1",
      status: "in_progress",
      conversation: [
        { role: "interviewer", content: "Q1?", questionNumber: 1, timestamp: "2026-01-01T00:00:00Z" },
        { role: "candidate", content: "A1", timestamp: "2026-01-01T00:01:00Z" },
        { role: "interviewer", content: "Q2?", questionNumber: 2, timestamp: "2026-01-01T00:02:00Z" },
      ],
      context: { currentQuestion: 2, totalQuestions: 8 },
      started_at: "2026-01-01T00:00:00Z",
      completed_at: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [session] }); // get session

    const app = createApp();
    const response = await request(app)
      .get("/api/candidate/interview/status")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(200);
    expect(response.body.hasSession).toBe(true);
    expect(response.body.sessionId).toBe("session-1");
    expect(response.body.status).toBe("in_progress");
    expect(response.body.questionNumber).toBe(2);
    expect(response.body.totalQuestions).toBe(8);
    expect(response.body.currentQuestion).toBe("Q2?");
    expect(response.body.answeredCount).toBe(1);
  });

  it("should return not_started when no session", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [] }); // no session

    const app = createApp();
    const response = await request(app)
      .get("/api/candidate/interview/status")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(200);
    expect(response.body.hasSession).toBe(false);
    expect(response.body.status).toBe("not_started");
  });

  it("should not include currentQuestion for completed sessions", async () => {
    const session = {
      id: "session-1",
      status: "completed",
      conversation: [
        { role: "interviewer", content: "Q1?", questionNumber: 1, timestamp: "2026-01-01T00:00:00Z" },
        { role: "candidate", content: "A1", timestamp: "2026-01-01T00:01:00Z" },
      ],
      context: { currentQuestion: 8 },
      started_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T01:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [candidate] }) // candidateAuth
      .mockResolvedValueOnce({ rows: [session] }); // get session

    const app = createApp();
    const response = await request(app)
      .get("/api/candidate/interview/status")
      .set("X-Candidate-Token", "valid-token");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(response.body.currentQuestion).toBeUndefined();
    expect(response.body.completedAt).toBe("2026-01-01T01:00:00Z");
  });
});
