import { Router, Response } from "express";
import { getPool } from "../db";
import { candidateAuth, CandidateRequest } from "../middleware/candidateAuth";

const router = Router();

// GET /api/candidate/session - Get candidate's session info
router.get(
  "/api/candidate/session",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const pool = getPool();

      const assessmentResult = await pool.query(
        "SELECT id, title, description, role, config, status FROM assessments WHERE id = $1",
        [candidate.assessment_id]
      );

      if (assessmentResult.rows.length === 0) {
        res.status(404).json({ error: "Assessment not found" });
        return;
      }

      res.json({
        candidate: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          status: candidate.status,
        },
        assessment: assessmentResult.rows[0],
      });
    } catch (err) {
      console.error("Error getting candidate session:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
