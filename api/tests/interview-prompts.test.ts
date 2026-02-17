import { describe, it, expect } from "vitest";
import {
  buildFirstQuestionPrompt,
  buildFollowUpQuestionPrompt,
} from "../src/prompts/interview";

describe("buildFirstQuestionPrompt", () => {
  it("should include role and tech stack", () => {
    const prompt = buildFirstQuestionPrompt({
      role: "Senior Backend Engineer",
      techStack: ["Node.js", "PostgreSQL", "Redis"],
      rubric: { criteria: [] },
      totalQuestions: 8,
    });

    expect(prompt).toContain("Senior Backend Engineer");
    expect(prompt).toContain("Node.js, PostgreSQL, Redis");
    expect(prompt).toContain("1 of 8");
  });

  it("should use fallback when tech stack is empty", () => {
    const prompt = buildFirstQuestionPrompt({
      role: "Software Engineer",
      techStack: [],
      rubric: { criteria: [] },
      totalQuestions: 8,
    });

    expect(prompt).toContain("general software engineering");
  });

  it("should format rubric criteria", () => {
    const prompt = buildFirstQuestionPrompt({
      role: "Engineer",
      techStack: ["TypeScript"],
      rubric: {
        criteria: [
          { name: "Problem Solving", description: "Analytical skills", weight: 0.3 },
          { name: "Code Quality", description: "Clean code practices", weight: 0.2 },
        ],
      },
      totalQuestions: 8,
    });

    expect(prompt).toContain("Problem Solving");
    expect(prompt).toContain("Analytical skills");
    expect(prompt).toContain("0.3");
    expect(prompt).toContain("Code Quality");
  });
});

describe("buildFollowUpQuestionPrompt", () => {
  it("should include conversation history", () => {
    const prompt = buildFollowUpQuestionPrompt({
      role: "Engineer",
      techStack: ["Python"],
      rubric: { criteria: [] },
      questionNumber: 3,
      totalQuestions: 8,
      conversation: [
        { role: "interviewer", content: "Tell me about Python", questionNumber: 1, timestamp: "2026-01-01T00:00:00Z" },
        { role: "candidate", content: "I love Python", timestamp: "2026-01-01T00:01:00Z" },
        { role: "interviewer", content: "Explain decorators", questionNumber: 2, timestamp: "2026-01-01T00:02:00Z" },
        { role: "candidate", content: "They wrap functions", timestamp: "2026-01-01T00:03:00Z" },
      ],
    });

    expect(prompt).toContain("3 of 8");
    expect(prompt).toContain("Tell me about Python");
    expect(prompt).toContain("I love Python");
    expect(prompt).toContain("Interviewer");
    expect(prompt).toContain("Candidate");
  });

  it("should include synthesis instruction for final questions", () => {
    const prompt = buildFollowUpQuestionPrompt({
      role: "Engineer",
      techStack: [],
      rubric: { criteria: [] },
      questionNumber: 7,
      totalQuestions: 8,
      conversation: [
        { role: "interviewer", content: "Q1", questionNumber: 1, timestamp: "2026-01-01T00:00:00Z" },
        { role: "candidate", content: "A1", timestamp: "2026-01-01T00:01:00Z" },
      ],
    });

    expect(prompt).toContain("synthesis question");
  });

  it("should not include synthesis instruction for early questions", () => {
    const prompt = buildFollowUpQuestionPrompt({
      role: "Engineer",
      techStack: [],
      rubric: { criteria: [] },
      questionNumber: 3,
      totalQuestions: 8,
      conversation: [
        { role: "interviewer", content: "Q1", questionNumber: 1, timestamp: "2026-01-01T00:00:00Z" },
        { role: "candidate", content: "A1", timestamp: "2026-01-01T00:01:00Z" },
      ],
    });

    expect(prompt).not.toContain("synthesis question");
  });
});
