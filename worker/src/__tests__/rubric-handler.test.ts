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
import { handleRubricGenerate } from "../handlers/rubric";

const mockRubric = {
  criteria: [
    {
      name: "Technical Knowledge",
      description: "Understanding of core technologies",
      weight: 0.4,
      levels: [
        { score: 1, label: "Novice", description: "Basic awareness" },
        { score: 5, label: "Expert", description: "Deep expertise" },
      ],
    },
  ],
};

describe("handleRubricGenerate", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPool: any;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPool = {
      query: vi.fn(),
    };

    mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(mockRubric) }],
    });

    vi.mocked(getClaudeClient).mockReturnValue({
      messages: { create: mockCreate },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it("should return error when assessmentId is missing", async () => {
    const result = await handleRubricGenerate({}, mockPool);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing assessmentId");
  });

  it("should return error when assessment is not found", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await expect(
      handleRubricGenerate({ assessmentId: "nonexistent" }, mockPool)
    ).rejects.toThrow("Assessment nonexistent not found");
  });

  it("should generate rubric and store it in the database", async () => {
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

    const result = await handleRubricGenerate(
      { assessmentId: "assess-1" },
      mockPool
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.assessmentId).toBe("assess-1");
    expect(result.data!.rubric).toEqual(mockRubric);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
      })
    );

    // Verify rubric was stored
    expect(mockPool.query).toHaveBeenCalledTimes(2);
    const updateCall = mockPool.query.mock.calls[1];
    expect(updateCall[0]).toContain("UPDATE assessments SET rubric");
    expect(updateCall[1][1]).toBe("assess-1");
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

    const result = await handleRubricGenerate(
      { assessmentId: "assess-2" },
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

    const result = await handleRubricGenerate(
      { assessmentId: "assess-3" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to parse rubric JSON");
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

    const result = await handleRubricGenerate(
      { assessmentId: "assess-4" },
      mockPool
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("No text response");
  });
});
