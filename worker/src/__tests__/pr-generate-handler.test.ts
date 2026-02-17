import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../claude", () => ({
  getClaudeClient: vi.fn(),
}));

vi.mock("../config", () => ({
  config: {
    anthropic: { model: "claude-sonnet-4-20250514" },
  },
}));

import { getClaudeClient } from "../claude";
import { handlePrGenerate } from "../handlers/pr-generate";

const mockPrData = {
  title: "Add user authentication endpoint",
  description: "This PR adds a login endpoint with JWT support.",
  files: [
    {
      path: "src/auth/login.ts",
      language: "typescript",
      content: 'export function login() { return "ok"; }',
      diff: "@@ -0,0 +1,1 @@\n+export function login() { return \"ok\"; }",
    },
    {
      path: "src/auth/middleware.ts",
      language: "typescript",
      content: 'export function auth() { return true; }',
      diff: "@@ -0,0 +1,1 @@\n+export function auth() { return true; }",
    },
    {
      path: "src/routes/users.ts",
      language: "typescript",
      content: 'export function getUsers() { return []; }',
      diff: "@@ -0,0 +1,1 @@\n+export function getUsers() { return []; }",
    },
  ],
  issues: [
    {
      file: "src/auth/login.ts",
      line: 1,
      category: "security",
      severity: "high",
      description: "No password hashing",
    },
    {
      file: "src/auth/middleware.ts",
      line: 1,
      category: "bug",
      severity: "high",
      description: "Always returns true",
    },
    {
      file: "src/routes/users.ts",
      line: 1,
      category: "style",
      severity: "low",
      description: "Empty array instead of DB query",
    },
    {
      file: "src/auth/login.ts",
      line: 1,
      category: "logic",
      severity: "medium",
      description: "No error handling",
    },
  ],
};

describe("handlePrGenerate", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPool: any;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPool = {
      query: vi.fn(),
    };

    mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(mockPrData) }],
    });

    vi.mocked(getClaudeClient).mockReturnValue({
      messages: { create: mockCreate },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it("should return error when assessmentId is missing", async () => {
    const result = await handlePrGenerate(
      { candidateId: "cand-1", exerciseId: "ex-1" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing assessmentId");
  });

  it("should return error when candidateId is missing", async () => {
    const result = await handlePrGenerate(
      { assessmentId: "assess-1", exerciseId: "ex-1" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing candidateId");
  });

  it("should return error when exerciseId is missing", async () => {
    const result = await handlePrGenerate(
      { assessmentId: "assess-1", candidateId: "cand-1" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing exerciseId");
  });

  it("should return error when assessment is not found", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await expect(
      handlePrGenerate(
        { assessmentId: "nonexistent", candidateId: "cand-1", exerciseId: "ex-1" },
        mockPool
      )
    ).rejects.toThrow("Assessment nonexistent not found");
  });

  it("should generate PR data and store it in the database", async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          id: "assess-1",
          title: "Backend Engineer",
          role: "Backend Engineer",
          description: "Evaluate backend skills",
          config: { tech_stack: ["Node.js", "PostgreSQL"] },
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await handlePrGenerate(
      { assessmentId: "assess-1", candidateId: "cand-1", exerciseId: "ex-1" },
      mockPool
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.exerciseId).toBe("ex-1");
    expect(result.data!.assessmentId).toBe("assess-1");
    expect(result.data!.candidateId).toBe("cand-1");
    expect(result.data!.generatedAt).toBeDefined();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
      })
    );

    // Verify PR data was stored
    expect(mockPool.query).toHaveBeenCalledTimes(2);
    const updateCall = mockPool.query.mock.calls[1];
    expect(updateCall[0]).toContain("UPDATE pr_exercises SET generated_data");
    expect(updateCall[1][1]).toBe("ex-1");
  });

  it("should handle empty tech_stack gracefully", async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          id: "assess-2",
          title: "General Role",
          role: "Engineer",
          description: null,
          config: {},
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await handlePrGenerate(
      { assessmentId: "assess-2", candidateId: "cand-1", exerciseId: "ex-2" },
      mockPool
    );

    expect(result.success).toBe(true);
  });

  it("should return error when Claude returns invalid JSON", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        id: "assess-3",
        title: "Test",
        role: "Test",
        description: "Test",
        config: {},
      }],
    });

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "This is not JSON" }],
    });

    const result = await handlePrGenerate(
      { assessmentId: "assess-3", candidateId: "cand-1", exerciseId: "ex-3" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to parse PR data JSON");
  });

  it("should return error when Claude returns no text content", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        id: "assess-4",
        title: "Test",
        role: "Test",
        description: "Test",
        config: {},
      }],
    });

    mockCreate.mockResolvedValue({ content: [] });

    const result = await handlePrGenerate(
      { assessmentId: "assess-4", candidateId: "cand-1", exerciseId: "ex-4" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("No text response");
  });
});
