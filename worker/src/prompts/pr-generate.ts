export interface PrGeneratePromptInput {
  role: string;
  techStack: string[];
  description: string;
}

export function buildPrGeneratePrompt(input: PrGeneratePromptInput): string {
  const techList = input.techStack.length > 0
    ? input.techStack.join(", ")
    : "general software engineering";

  return `You are an expert software engineer creating a realistic pull request for a code review exercise. The candidate being evaluated works as a ${input.role} with a tech stack of ${techList}.

## Context
${input.description}

## Instructions
Generate a realistic pull request that a junior-to-mid-level developer might submit. The PR should:

1. Include 3-5 files with realistic file paths and content relevant to the tech stack.
2. Have a clear PR title and description explaining the feature or fix.
3. Contain exactly 4-6 intentional issues across different categories:
   - **Bug**: A logical error that would cause incorrect behavior (e.g., off-by-one, wrong condition, missing null check)
   - **Security**: A vulnerability (e.g., SQL injection, missing input validation, exposed secrets, XSS)
   - **Style**: Code style or readability problems (e.g., inconsistent naming, magic numbers, poor variable names)
   - **Logic**: Flawed business logic or missing edge case handling
   - **Performance**: An inefficiency (e.g., N+1 query, unnecessary computation in a loop)

Each issue should be subtle enough to require careful review but clear enough that a competent engineer would catch it.

Respond with ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "title": "PR title string",
  "description": "PR description in markdown format",
  "files": [
    {
      "path": "src/path/to/file.ext",
      "language": "typescript",
      "content": "full file content as a string",
      "diff": "unified diff showing only the changes"
    }
  ],
  "issues": [
    {
      "file": "src/path/to/file.ext",
      "line": 42,
      "category": "bug",
      "severity": "high",
      "description": "Brief description of the issue for internal tracking only"
    }
  ]
}

Requirements for the JSON:
- "files" array must have 3-5 entries
- "issues" array must have 4-6 entries
- Each issue category must be one of: "bug", "security", "style", "logic", "performance"
- Each issue severity must be one of: "high", "medium", "low"
- The diff field must be a valid unified diff format
- File content must be syntactically valid code
- Issues must reference real lines in the file content`;
}
