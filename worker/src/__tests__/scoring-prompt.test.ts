import { describe, it, expect } from "vitest";
import { buildScoringPrompt } from "../prompts/scoring";

describe("buildScoringPrompt", () => {
  it("should include role in the prompt", () => {
    const prompt = buildScoringPrompt({
      role: "Backend Engineer",
      rubric: { criteria: [] },
      interviewConversation: [],
      prReviewComments: [],
      prIssues: [],
      behavioralSignals: [],
    });

    expect(prompt).toContain("Backend Engineer");
  });

  it("should include rubric data", () => {
    const rubric = {
      criteria: [{ name: "Technical Knowledge", weight: 0.4 }],
    };

    const prompt = buildScoringPrompt({
      role: "Engineer",
      rubric,
      interviewConversation: [],
      prReviewComments: [],
      prIssues: [],
      behavioralSignals: [],
    });

    expect(prompt).toContain("Technical Knowledge");
    expect(prompt).toContain("0.4");
  });

  it("should include interview conversation data", () => {
    const conversation = [
      { role: "assistant", content: "Tell me about your experience." },
      { role: "user", content: "I have 5 years of experience." },
    ];

    const prompt = buildScoringPrompt({
      role: "Engineer",
      rubric: {},
      interviewConversation: conversation,
      prReviewComments: [],
      prIssues: [],
      behavioralSignals: [],
    });

    expect(prompt).toContain("5 years of experience");
  });

  it("should include PR review comments and issues", () => {
    const prompt = buildScoringPrompt({
      role: "Engineer",
      rubric: {},
      interviewConversation: [],
      prReviewComments: [{ file: "index.ts", comment: "Missing null check" }],
      prIssues: [{ file: "index.ts", category: "bug", severity: "high" }],
      behavioralSignals: [],
    });

    expect(prompt).toContain("Missing null check");
    expect(prompt).toContain("bug");
  });

  it("should include behavioral signals", () => {
    const prompt = buildScoringPrompt({
      role: "Engineer",
      rubric: {},
      interviewConversation: [],
      prReviewComments: [],
      prIssues: [],
      behavioralSignals: [
        { signal_type: "typing_rhythm", data: { wpm: 65 } },
        { signal_type: "paste_detection", data: { pasteCount: 3 } },
      ],
    });

    expect(prompt).toContain("typing_rhythm");
    expect(prompt).toContain("paste_detection");
    expect(prompt).toContain("65");
  });

  it("should request JSON response format", () => {
    const prompt = buildScoringPrompt({
      role: "Engineer",
      rubric: {},
      interviewConversation: [],
      prReviewComments: [],
      prIssues: [],
      behavioralSignals: [],
    });

    expect(prompt).toContain("ONLY valid JSON");
    expect(prompt).toContain("interview_score");
    expect(prompt).toContain("pr_review_score");
    expect(prompt).toContain("behavioral_score");
    expect(prompt).toContain("overall_score");
    expect(prompt).toContain("flags");
    expect(prompt).toContain("breakdown");
  });
});
