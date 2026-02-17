import { Pool } from "pg";
import { getClaudeClient } from "../claude";
import { config } from "../config";
import { buildRubricPrompt } from "../prompts/rubric";
import { ProcessResult } from "../processor";

interface AssessmentRow {
  id: string;
  title: string;
  role: string;
  description: string | null;
  config: Record<string, unknown>;
}

async function fetchAssessment(pool: Pool, assessmentId: string): Promise<AssessmentRow> {
  const res = await pool.query<AssessmentRow>(
    `SELECT id, title, role, description, config FROM assessments WHERE id = $1`,
    [assessmentId]
  );
  if (res.rows.length === 0) {
    throw new Error(`Assessment ${assessmentId} not found`);
  }
  return res.rows[0];
}

async function storeRubric(
  pool: Pool,
  assessmentId: string,
  rubric: Record<string, unknown>
): Promise<void> {
  await pool.query(
    `UPDATE assessments SET rubric = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(rubric), assessmentId]
  );
}

export async function handleRubricGenerate(
  payload: Record<string, unknown>,
  pool: Pool
): Promise<ProcessResult> {
  const assessmentId = payload.assessmentId as string;
  if (!assessmentId) {
    return { success: false, error: "Missing assessmentId in payload" };
  }

  const assessment = await fetchAssessment(pool, assessmentId);

  const techStack = Array.isArray(assessment.config?.tech_stack)
    ? (assessment.config.tech_stack as string[])
    : [];

  const prompt = buildRubricPrompt({
    title: assessment.title,
    role: assessment.role,
    description: assessment.description || "",
    techStack,
  });

  const client = getClaudeClient();
  const message = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { success: false, error: "No text response from Claude" };
  }

  let rubric: Record<string, unknown>;
  try {
    rubric = JSON.parse(textBlock.text);
  } catch {
    return { success: false, error: "Failed to parse rubric JSON from Claude response" };
  }

  await storeRubric(pool, assessmentId, rubric);

  return {
    success: true,
    data: {
      assessmentId,
      rubric,
      generatedAt: new Date().toISOString(),
    },
  };
}
