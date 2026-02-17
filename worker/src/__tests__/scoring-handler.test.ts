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
import { handleScoringGenerate } from "../handlers/scoring";

const mockScoreResponse = {
  interview_score: 82,
  pr_review_score: 75,
  behavioral_score: 88,
  overall_score: 81.3,
  reasoning: "The candidate demonstrated strong technical knowledge with good communication.",
  flags: ["thorough-reviewer", "strong-communicator"],
  breakdown: {
    interview: {
      technical_knowledge: 80,
      problem_solving: 85,
      communication: 82,
      notes: "Good depth on system design questions",
    },
    pr_review: {
      issues_found: 4,
      issues_total: 6,
      feedback_quality: 75,
      security_awareness: 70,
      notes: "Caught the main security issue",
    },
    behavioral: {
      authenticity: 90,
      engagement: 85,
      notes: "Consistent typing pattern, no red flags",
    },
  },
};

describe("handleScoringGenerate", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPool: any;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPool = {
      query: vi.fn(),
    };

    mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(mockScoreResponse) }],
    });

    vi.mocked(getClaudeClient).mockReturnValue({
      messages: { create: mockCreate },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it("should return error when candidateId is missing", async () => {
    const result = await handleScoringGenerate(
      { assessmentId: "assess-1" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing candidateId");
  });

  it("should return error when assessmentId is missing", async () => {
    const result = await handleScoringGenerate(
      { candidateId: "cand-1" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing assessmentId");
  });

  it("should return error when assessment is not found", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await expect(
      handleScoringGenerate(
        { candidateId: "cand-1", assessmentId: "nonexistent" },
        mockPool
      )
    ).rejects.toThrow("Assessment nonexistent not found");
  });

  it("should generate scores and store them in the database", async () => {
    // fetchAssessment
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          id: "assess-1",
          title: "Backend Engineer",
          role: "Backend Engineer",
          description: "Backend assessment",
          rubric: { criteria: [{ name: "Technical", weight: 0.5 }] },
          config: { tech_stack: ["Node.js"] },
        }],
      })
      // fetchInterviewSession
      .mockResolvedValueOnce({
        rows: [{
          id: "session-1",
          conversation: [{ role: "assistant", content: "Hello" }],
          status: "completed",
        }],
      })
      // fetchPrExercise
      .mockResolvedValueOnce({
        rows: [{
          id: "ex-1",
          generated_data: {
            issues: [{ file: "test.ts", line: 1, category: "bug" }],
          },
          submission: {
            comments: [{ file: "test.ts", line: 1, comment: "Found a bug" }],
          },
          status: "submitted",
        }],
      })
      // fetchBehavioralSignals
      .mockResolvedValueOnce({
        rows: [{
          id: "sig-1",
          signal_type: "typing_rhythm",
          data: { wpm: 65 },
          recorded_at: "2026-01-01T00:00:00Z",
        }],
      })
      // storeScore INSERT RETURNING
      .mockResolvedValueOnce({
        rows: [{ id: "score-1" }],
      });

    const result = await handleScoringGenerate(
      { candidateId: "cand-1", assessmentId: "assess-1" },
      mockPool
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.scoreId).toBe("score-1");
    expect(result.data!.candidateId).toBe("cand-1");
    expect(result.data!.assessmentId).toBe("assess-1");
    expect(result.data!.overallScore).toBe(81.3);
    expect(result.data!.flags).toEqual(["thorough-reviewer", "strong-communicator"]);
    expect(result.data!.generatedAt).toBeDefined();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
      })
    );

    // Verify score was stored (5th query call)
    expect(mockPool.query).toHaveBeenCalledTimes(5);
    const storeCall = mockPool.query.mock.calls[4];
    expect(storeCall[0]).toContain("INSERT INTO scores");
    expect(storeCall[1][0]).toBe("cand-1");
    expect(storeCall[1][1]).toBe("assess-1");
    expect(storeCall[1][2]).toBe(81.3);
  });

  it("should handle missing interview and PR data gracefully", async () => {
    // fetchAssessment
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          id: "assess-2",
          title: "General Role",
          role: "Engineer",
          description: null,
          rubric: {},
          config: {},
        }],
      })
      // fetchInterviewSession - none
      .mockResolvedValueOnce({ rows: [] })
      // fetchPrExercise - none
      .mockResolvedValueOnce({ rows: [] })
      // fetchBehavioralSignals - none
      .mockResolvedValueOnce({ rows: [] })
      // storeScore
      .mockResolvedValueOnce({ rows: [{ id: "score-2" }] });

    const result = await handleScoringGenerate(
      { candidateId: "cand-2", assessmentId: "assess-2" },
      mockPool
    );

    expect(result.success).toBe(true);
  });

  it("should return error when Claude returns invalid JSON", async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          id: "assess-3",
          title: "Test",
          role: "Test",
          description: "Test",
          rubric: {},
          config: {},
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "This is not JSON" }],
    });

    const result = await handleScoringGenerate(
      { candidateId: "cand-3", assessmentId: "assess-3" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to parse scoring JSON");
  });

  it("should return error when Claude returns no text content", async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          id: "assess-4",
          title: "Test",
          role: "Test",
          description: "Test",
          rubric: {},
          config: {},
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockCreate.mockResolvedValue({ content: [] });

    const result = await handleScoringGenerate(
      { candidateId: "cand-4", assessmentId: "assess-4" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("No text response");
  });
});
