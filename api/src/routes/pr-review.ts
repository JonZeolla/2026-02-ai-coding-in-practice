import { Router, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "../db";
import { getQueue } from "../queue";
import { candidateAuth, CandidateRequest } from "../middleware/candidateAuth";

const router = Router();

// POST /api/candidate/pr-review/start - Start PR review exercise
// Triggers pr.generate job or returns existing exercise
router.post(
  "/api/candidate/pr-review/start",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const pool = getPool();

      // Check for existing exercise
      const existing = await pool.query(
        `SELECT id, status, generated_data, created_at FROM pr_exercises
         WHERE candidate_id = $1 AND assessment_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [candidate.id, candidate.assessment_id]
      );

      if (existing.rows.length > 0) {
        const exercise = existing.rows[0];
        res.json({
          exerciseId: exercise.id,
          status: exercise.status,
        });
        return;
      }

      // Create new exercise row
      const exerciseId = uuidv4();
      await pool.query(
        `INSERT INTO pr_exercises (id, candidate_id, assessment_id, status, started_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'generating', NOW(), NOW(), NOW())`,
        [exerciseId, candidate.id, candidate.assessment_id]
      );

      // Create job in jobs table
      const jobId = uuidv4();
      const jobPayload = {
        assessmentId: candidate.assessment_id,
        candidateId: candidate.id,
        exerciseId,
      };

      await pool.query(
        `INSERT INTO jobs (id, type, status, payload, created_at, updated_at)
         VALUES ($1, $2, 'pending', $3, NOW(), NOW())`,
        [jobId, "pr.generate", JSON.stringify(jobPayload)]
      );

      // Add to BullMQ queue
      const queue = getQueue();
      try {
        await queue.add("pr.generate", { jobId, ...jobPayload }, { jobId });
      } catch (queueErr) {
        // Clean up on queue failure
        await pool.query("DELETE FROM jobs WHERE id = $1", [jobId]);
        await pool.query("DELETE FROM pr_exercises WHERE id = $1", [exerciseId]);
        throw queueErr;
      }

      res.status(201).json({
        exerciseId,
        status: "generating",
      });
    } catch (err) {
      console.error("Error starting PR review:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/candidate/pr-review - Get PR data for review
router.get(
  "/api/candidate/pr-review",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const pool = getPool();

      const result = await pool.query(
        `SELECT id, status, generated_data, submission, started_at, created_at
         FROM pr_exercises
         WHERE candidate_id = $1 AND assessment_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [candidate.id, candidate.assessment_id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "No PR exercise found. Start one first." });
        return;
      }

      const exercise = result.rows[0];

      // Strip internal issue annotations from the generated data
      const prData = exercise.generated_data || {};
      const candidateView: Record<string, unknown> = {
        title: prData.title,
        description: prData.description,
        files: prData.files,
      };

      res.json({
        exerciseId: exercise.id,
        status: exercise.status,
        pr: exercise.status === "ready" ? candidateView : null,
        submission: exercise.submission,
        startedAt: exercise.started_at,
      });
    } catch (err) {
      console.error("Error getting PR review:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/candidate/pr-review/comment - Add inline comment to PR
router.post(
  "/api/candidate/pr-review/comment",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const pool = getPool();
      const { file, line, comment } = req.body;

      if (!file || typeof file !== "string") {
        res.status(400).json({ error: "Field 'file' is required and must be a string" });
        return;
      }
      if (!line || typeof line !== "number") {
        res.status(400).json({ error: "Field 'line' is required and must be a number" });
        return;
      }
      if (!comment || typeof comment !== "string") {
        res.status(400).json({ error: "Field 'comment' is required and must be a string" });
        return;
      }

      // Get the exercise
      const result = await pool.query(
        `SELECT id, status, submission FROM pr_exercises
         WHERE candidate_id = $1 AND assessment_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [candidate.id, candidate.assessment_id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "No PR exercise found" });
        return;
      }

      const exercise = result.rows[0];

      if (exercise.status === "submitted") {
        res.status(400).json({ error: "PR review already submitted" });
        return;
      }

      if (exercise.status !== "ready") {
        res.status(400).json({ error: "PR exercise is not ready for review" });
        return;
      }

      // Append comment to submission
      const submission = exercise.submission || { comments: [] };
      const comments = Array.isArray(submission.comments) ? submission.comments : [];
      comments.push({
        id: uuidv4(),
        file,
        line,
        comment,
        createdAt: new Date().toISOString(),
      });

      await pool.query(
        `UPDATE pr_exercises SET submission = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify({ ...submission, comments }), exercise.id]
      );

      res.status(201).json({
        commentId: comments[comments.length - 1].id,
        totalComments: comments.length,
      });
    } catch (err) {
      console.error("Error adding PR comment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/candidate/pr-review/submit - Finalize the PR review
router.post(
  "/api/candidate/pr-review/submit",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const pool = getPool();

      const result = await pool.query(
        `SELECT id, status, submission FROM pr_exercises
         WHERE candidate_id = $1 AND assessment_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [candidate.id, candidate.assessment_id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "No PR exercise found" });
        return;
      }

      const exercise = result.rows[0];

      if (exercise.status === "submitted") {
        res.status(400).json({ error: "PR review already submitted" });
        return;
      }

      if (exercise.status !== "ready") {
        res.status(400).json({ error: "PR exercise is not ready for submission" });
        return;
      }

      const submission = exercise.submission || { comments: [] };
      const comments = Array.isArray(submission.comments) ? submission.comments : [];

      if (comments.length === 0) {
        res.status(400).json({ error: "Cannot submit review with no comments" });
        return;
      }

      await pool.query(
        `UPDATE pr_exercises SET status = 'submitted', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [exercise.id]
      );

      res.json({
        exerciseId: exercise.id,
        status: "submitted",
        totalComments: comments.length,
        submittedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error submitting PR review:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
