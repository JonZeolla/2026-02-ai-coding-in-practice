import { Router, Response } from "express";
import { getPool } from "../db";
import { candidateAuth, CandidateRequest } from "../middleware/candidateAuth";
import { getClaudeClient, getModel } from "../claude";
import {
  buildFirstQuestionPrompt,
  buildFollowUpQuestionPrompt,
  ConversationMessage,
} from "../prompts/interview";

const router = Router();

const TOTAL_QUESTIONS = 8;

// POST /api/candidate/interview/start - Start an interview session
router.post(
  "/api/candidate/interview/start",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const pool = getPool();

      // Check for existing active session
      const existing = await pool.query(
        `SELECT id, status FROM interview_sessions
         WHERE candidate_id = $1 AND assessment_id = $2
         AND status IN ('in_progress', 'pending')
         ORDER BY created_at DESC LIMIT 1`,
        [candidate.id, candidate.assessment_id]
      );

      if (existing.rows.length > 0) {
        res.status(409).json({
          error: "Interview session already exists",
          sessionId: existing.rows[0].id,
          status: existing.rows[0].status,
        });
        return;
      }

      // Fetch assessment with rubric and config
      const assessmentResult = await pool.query(
        `SELECT id, title, role, description, rubric, config
         FROM assessments WHERE id = $1`,
        [candidate.assessment_id]
      );

      if (assessmentResult.rows.length === 0) {
        res.status(404).json({ error: "Assessment not found" });
        return;
      }

      const assessment = assessmentResult.rows[0];
      const techStack = Array.isArray(assessment.config?.tech_stack)
        ? (assessment.config.tech_stack as string[])
        : [];

      // Generate first question via Claude
      const prompt = buildFirstQuestionPrompt({
        role: assessment.role,
        techStack,
        rubric: assessment.rubric,
        totalQuestions: TOTAL_QUESTIONS,
      });

      const client = getClaudeClient();
      const message = await client.messages.create({
        model: getModel(),
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(502).json({ error: "Failed to generate interview question" });
        return;
      }

      const firstQuestion = textBlock.text.trim();
      const now = new Date().toISOString();

      const conversation: ConversationMessage[] = [
        {
          role: "interviewer",
          content: firstQuestion,
          questionNumber: 1,
          timestamp: now,
        },
      ];

      const context = {
        techStack,
        rubric: assessment.rubric,
        role: assessment.role,
        totalQuestions: TOTAL_QUESTIONS,
        currentQuestion: 1,
      };

      // Create the interview session
      const sessionResult = await pool.query(
        `INSERT INTO interview_sessions (candidate_id, assessment_id, status, conversation, context, started_at)
         VALUES ($1, $2, 'in_progress', $3, $4, NOW())
         RETURNING id, status, started_at, created_at`,
        [
          candidate.id,
          candidate.assessment_id,
          JSON.stringify(conversation),
          JSON.stringify(context),
        ]
      );

      // Update candidate status
      await pool.query(
        `UPDATE candidates SET status = 'interviewing', updated_at = NOW() WHERE id = $1`,
        [candidate.id]
      );

      const session = sessionResult.rows[0];

      res.status(201).json({
        sessionId: session.id,
        status: session.status,
        question: firstQuestion,
        questionNumber: 1,
        totalQuestions: TOTAL_QUESTIONS,
        startedAt: session.started_at,
      });
    } catch (err) {
      console.error("Error starting interview:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/candidate/interview/answer - Submit an answer and get next question
router.post(
  "/api/candidate/interview/answer",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const { answer } = req.body;

      if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
        res.status(400).json({ error: "Answer is required" });
        return;
      }

      const pool = getPool();

      // Get active session
      const sessionResult = await pool.query(
        `SELECT id, conversation, context, status
         FROM interview_sessions
         WHERE candidate_id = $1 AND assessment_id = $2 AND status = 'in_progress'
         ORDER BY created_at DESC LIMIT 1`,
        [candidate.id, candidate.assessment_id]
      );

      if (sessionResult.rows.length === 0) {
        res.status(404).json({ error: "No active interview session found" });
        return;
      }

      const session = sessionResult.rows[0];
      const conversation: ConversationMessage[] = session.conversation;
      const context = session.context;
      const now = new Date().toISOString();

      // Add candidate's answer to conversation
      conversation.push({
        role: "candidate",
        content: answer.trim(),
        timestamp: now,
      });

      const currentQuestion = context.currentQuestion as number;
      const nextQuestionNumber = currentQuestion + 1;

      // Check if interview is complete
      if (nextQuestionNumber > TOTAL_QUESTIONS) {
        // Mark session as completed
        await pool.query(
          `UPDATE interview_sessions
           SET conversation = $1, context = $2, status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE id = $3`,
          [
            JSON.stringify(conversation),
            JSON.stringify({ ...context, currentQuestion: currentQuestion }),
            session.id,
          ]
        );

        await pool.query(
          `UPDATE candidates SET status = 'interview_complete', updated_at = NOW() WHERE id = $1`,
          [candidate.id]
        );

        res.json({
          sessionId: session.id,
          status: "completed",
          questionNumber: currentQuestion,
          totalQuestions: TOTAL_QUESTIONS,
          message: "Interview complete. Thank you for your responses.",
        });
        return;
      }

      // Generate next question via Claude
      const prompt = buildFollowUpQuestionPrompt({
        role: context.role,
        techStack: context.techStack,
        rubric: context.rubric,
        questionNumber: nextQuestionNumber,
        totalQuestions: TOTAL_QUESTIONS,
        conversation,
      });

      const client = getClaudeClient();
      const message = await client.messages.create({
        model: getModel(),
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(502).json({ error: "Failed to generate next question" });
        return;
      }

      const nextQuestion = textBlock.text.trim();

      // Add interviewer question to conversation
      conversation.push({
        role: "interviewer",
        content: nextQuestion,
        questionNumber: nextQuestionNumber,
        timestamp: new Date().toISOString(),
      });

      const updatedContext = {
        ...context,
        currentQuestion: nextQuestionNumber,
      };

      // Update session
      await pool.query(
        `UPDATE interview_sessions
         SET conversation = $1, context = $2, updated_at = NOW()
         WHERE id = $3`,
        [
          JSON.stringify(conversation),
          JSON.stringify(updatedContext),
          session.id,
        ]
      );

      res.json({
        sessionId: session.id,
        status: "in_progress",
        question: nextQuestion,
        questionNumber: nextQuestionNumber,
        totalQuestions: TOTAL_QUESTIONS,
      });
    } catch (err) {
      console.error("Error processing interview answer:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/candidate/interview/status - Get interview session status
router.get(
  "/api/candidate/interview/status",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const pool = getPool();

      const sessionResult = await pool.query(
        `SELECT id, status, conversation, context, started_at, completed_at, created_at
         FROM interview_sessions
         WHERE candidate_id = $1 AND assessment_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [candidate.id, candidate.assessment_id]
      );

      if (sessionResult.rows.length === 0) {
        res.json({
          hasSession: false,
          status: "not_started",
        });
        return;
      }

      const session = sessionResult.rows[0];
      const conversation: ConversationMessage[] = session.conversation;
      const context = session.context;

      // Find the last interviewer question (the pending one)
      const lastQuestion = [...conversation]
        .reverse()
        .find((msg) => msg.role === "interviewer");

      res.json({
        hasSession: true,
        sessionId: session.id,
        status: session.status,
        questionNumber: context.currentQuestion || 0,
        totalQuestions: TOTAL_QUESTIONS,
        currentQuestion: session.status === "in_progress" ? lastQuestion?.content : undefined,
        answeredCount: conversation.filter((m) => m.role === "candidate").length,
        startedAt: session.started_at,
        completedAt: session.completed_at,
      });
    } catch (err) {
      console.error("Error getting interview status:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
