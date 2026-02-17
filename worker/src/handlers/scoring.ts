import { Pool } from "pg";
import { getClaudeClient } from "../claude";
import { config } from "../config";
import { buildScoringPrompt } from "../prompts/scoring";
import { ProcessResult } from "../processor";

interface AssessmentRow {
  id: string;
  title: string;
  role: string;
  description: string | null;
  rubric: Record<string, unknown>;
  config: Record<string, unknown>;
}

interface InterviewSessionRow {
  id: string;
  conversation: unknown[];
  status: string;
}

interface PrExerciseRow {
  id: string;
  generated_data: Record<string, unknown>;
  submission: Record<string, unknown> | null;
  status: string;
}

interface BehavioralSignalRow {
  id: string;
  signal_type: string;
  data: Record<string, unknown>;
  recorded_at: string;
}

async function fetchAssessment(pool: Pool, assessmentId: string): Promise<AssessmentRow> {
  const res = await pool.query<AssessmentRow>(
    `SELECT id, title, role, description, rubric, config FROM assessments WHERE id = $1`,
    [assessmentId]
  );
  if (res.rows.length === 0) {
    throw new Error(`Assessment ${assessmentId} not found`);
  }
  return res.rows[0];
}

async function fetchInterviewSession(
  pool: Pool,
  candidateId: string,
  assessmentId: string
): Promise<InterviewSessionRow | null> {
  const res = await pool.query<InterviewSessionRow>(
    `SELECT id, conversation, status FROM interview_sessions
     WHERE candidate_id = $1 AND assessment_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [candidateId, assessmentId]
  );
  return res.rows.length > 0 ? res.rows[0] : null;
}

async function fetchPrExercise(
  pool: Pool,
  candidateId: string,
  assessmentId: string
): Promise<PrExerciseRow | null> {
  const res = await pool.query<PrExerciseRow>(
    `SELECT id, generated_data, submission, status FROM pr_exercises
     WHERE candidate_id = $1 AND assessment_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [candidateId, assessmentId]
  );
  return res.rows.length > 0 ? res.rows[0] : null;
}

async function fetchBehavioralSignals(
  pool: Pool,
  candidateId: string,
  assessmentId: string
): Promise<BehavioralSignalRow[]> {
  const res = await pool.query<BehavioralSignalRow>(
    `SELECT id, signal_type, data, recorded_at FROM behavioral_signals
     WHERE candidate_id = $1 AND assessment_id = $2
     ORDER BY recorded_at ASC`,
    [candidateId, assessmentId]
  );
  return res.rows;
}

async function storeScore(
  pool: Pool,
  candidateId: string,
  assessmentId: string,
  scoreData: Record<string, unknown>
): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO scores (candidate_id, assessment_id, overall_score, breakdown, reasoning, metadata, scored_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
     RETURNING id`,
    [
      candidateId,
      assessmentId,
      scoreData.overall_score,
      JSON.stringify(scoreData.breakdown || {}),
      scoreData.reasoning,
      JSON.stringify({
        interview_score: scoreData.interview_score,
        pr_review_score: scoreData.pr_review_score,
        behavioral_score: scoreData.behavioral_score,
        flags: scoreData.flags,
      }),
    ]
  );
  return res.rows[0].id;
}

export async function handleScoringGenerate(
  payload: Record<string, unknown>,
  pool: Pool
): Promise<ProcessResult> {
  const candidateId = payload.candidateId as string;
  const assessmentId = payload.assessmentId as string;

  if (!candidateId) {
    return { success: false, error: "Missing candidateId in payload" };
  }
  if (!assessmentId) {
    return { success: false, error: "Missing assessmentId in payload" };
  }

  const assessment = await fetchAssessment(pool, assessmentId);

  const [interviewSession, prExercise, behavioralSignals] = await Promise.all([
    fetchInterviewSession(pool, candidateId, assessmentId),
    fetchPrExercise(pool, candidateId, assessmentId),
    fetchBehavioralSignals(pool, candidateId, assessmentId),
  ]);

  const prComments = prExercise?.submission
    ? (Array.isArray((prExercise.submission as Record<string, unknown>).comments)
        ? (prExercise.submission as Record<string, unknown>).comments as unknown[]
        : [])
    : [];

  const prIssues = prExercise?.generated_data
    ? (Array.isArray((prExercise.generated_data as Record<string, unknown>).issues)
        ? (prExercise.generated_data as Record<string, unknown>).issues as unknown[]
        : [])
    : [];

  const prompt = buildScoringPrompt({
    role: assessment.role,
    rubric: assessment.rubric,
    interviewConversation: interviewSession?.conversation || [],
    prReviewComments: prComments,
    prIssues,
    behavioralSignals,
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

  let scoreData: Record<string, unknown>;
  try {
    scoreData = JSON.parse(textBlock.text);
  } catch {
    return { success: false, error: "Failed to parse scoring JSON from Claude response" };
  }

  const scoreId = await storeScore(pool, candidateId, assessmentId, scoreData);

  return {
    success: true,
    data: {
      scoreId,
      candidateId,
      assessmentId,
      overallScore: scoreData.overall_score,
      flags: scoreData.flags,
      generatedAt: new Date().toISOString(),
    },
  };
}
