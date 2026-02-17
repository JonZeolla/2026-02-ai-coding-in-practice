import { Pool } from "pg";
import { getClaudeClient } from "../claude";
import { config } from "../config";
import { buildPrGeneratePrompt } from "../prompts/pr-generate";
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

async function storePrData(
  pool: Pool,
  exerciseId: string,
  prData: Record<string, unknown>
): Promise<void> {
  await pool.query(
    `UPDATE pr_exercises SET generated_data = $1, status = 'ready', updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(prData), exerciseId]
  );
}

export async function handlePrGenerate(
  payload: Record<string, unknown>,
  pool: Pool
): Promise<ProcessResult> {
  const assessmentId = payload.assessmentId as string;
  const candidateId = payload.candidateId as string;
  const exerciseId = payload.exerciseId as string;

  if (!assessmentId) {
    return { success: false, error: "Missing assessmentId in payload" };
  }
  if (!candidateId) {
    return { success: false, error: "Missing candidateId in payload" };
  }
  if (!exerciseId) {
    return { success: false, error: "Missing exerciseId in payload" };
  }

  const assessment = await fetchAssessment(pool, assessmentId);

  const techStack = Array.isArray(assessment.config?.tech_stack)
    ? (assessment.config.tech_stack as string[])
    : [];

  const prompt = buildPrGeneratePrompt({
    role: assessment.role,
    techStack,
    description: assessment.description || `Code review exercise for ${assessment.title}`,
  });

  const client = getClaudeClient();
  const message = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { success: false, error: "No text response from Claude" };
  }

  let prData: Record<string, unknown>;
  try {
    prData = JSON.parse(textBlock.text);
  } catch {
    return { success: false, error: "Failed to parse PR data JSON from Claude response" };
  }

  await storePrData(pool, exerciseId, prData);

  return {
    success: true,
    data: {
      exerciseId,
      assessmentId,
      candidateId,
      generatedAt: new Date().toISOString(),
    },
  };
}
