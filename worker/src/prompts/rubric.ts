export interface RubricPromptInput {
  title: string;
  role: string;
  description: string;
  techStack: string[];
}

export function buildRubricPrompt(input: RubricPromptInput): string {
  const techList = input.techStack.length > 0
    ? input.techStack.join(", ")
    : "general software engineering";

  return `You are an expert technical hiring assessor. Generate a structured scoring rubric for evaluating candidates for the following role.

## Role Details
- **Title**: ${input.title}
- **Role**: ${input.role}
- **Description**: ${input.description}
- **Tech Stack**: ${techList}

## Instructions
Generate a JSON rubric with evaluation criteria tailored to this role and tech stack. Each criterion should have:
- A clear name
- A description of what is being evaluated
- A weight (decimal, all weights must sum to 1.0)
- Scoring levels from 1-5 with descriptions

The rubric must cover:
1. Technical knowledge relevant to the listed tech stack
2. Problem-solving and system design ability
3. Code quality and best practices
4. Communication and collaboration skills
5. Any role-specific competencies inferred from the description

Respond with ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "criteria": [
    {
      "name": "string",
      "description": "string",
      "weight": 0.0,
      "levels": [
        { "score": 1, "label": "string", "description": "string" },
        { "score": 2, "label": "string", "description": "string" },
        { "score": 3, "label": "string", "description": "string" },
        { "score": 4, "label": "string", "description": "string" },
        { "score": 5, "label": "string", "description": "string" }
      ]
    }
  ]
}`;
}
