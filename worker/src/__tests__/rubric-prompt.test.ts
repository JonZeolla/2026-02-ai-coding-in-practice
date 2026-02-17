import { describe, it, expect } from "vitest";
import { buildRubricPrompt } from "../prompts/rubric";

describe("buildRubricPrompt", () => {
  it("should include role details in the prompt", () => {
    const prompt = buildRubricPrompt({
      title: "Senior Backend Engineer Assessment",
      role: "Senior Backend Engineer",
      description: "Evaluate backend engineering skills",
      techStack: ["Node.js", "PostgreSQL", "Redis"],
    });

    expect(prompt).toContain("Senior Backend Engineer Assessment");
    expect(prompt).toContain("Senior Backend Engineer");
    expect(prompt).toContain("Evaluate backend engineering skills");
    expect(prompt).toContain("Node.js, PostgreSQL, Redis");
  });

  it("should use default tech stack text when empty", () => {
    const prompt = buildRubricPrompt({
      title: "General Assessment",
      role: "Software Engineer",
      description: "General evaluation",
      techStack: [],
    });

    expect(prompt).toContain("general software engineering");
  });

  it("should include JSON structure requirements", () => {
    const prompt = buildRubricPrompt({
      title: "Test",
      role: "Test",
      description: "Test",
      techStack: ["TypeScript"],
    });

    expect(prompt).toContain('"criteria"');
    expect(prompt).toContain('"weight"');
    expect(prompt).toContain('"levels"');
    expect(prompt).toContain('"score"');
  });
});
