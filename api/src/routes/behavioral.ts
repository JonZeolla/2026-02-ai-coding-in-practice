import { Router, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "../db";
import { candidateAuth, CandidateRequest } from "../middleware/candidateAuth";

const router = Router();

const VALID_SIGNAL_TYPES = [
  "typing_rhythm",
  "paste_detection",
  "tab_focus",
  "response_timing",
  "navigation",
  "interaction",
];

// POST /api/candidate/behavioral - Submit behavioral signal data
router.post(
  "/api/candidate/behavioral",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const { signalType, data, sessionId } = req.body;

      if (!signalType || typeof signalType !== "string") {
        res.status(400).json({ error: "Field 'signalType' is required and must be a string" });
        return;
      }

      if (!VALID_SIGNAL_TYPES.includes(signalType)) {
        res.status(400).json({
          error: `Invalid signalType. Must be one of: ${VALID_SIGNAL_TYPES.join(", ")}`,
        });
        return;
      }

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        res.status(400).json({ error: "Field 'data' is required and must be an object" });
        return;
      }

      const pool = getPool();

      // Validate sessionId if provided
      if (sessionId) {
        const sessionCheck = await pool.query(
          `SELECT id FROM interview_sessions WHERE id = $1 AND candidate_id = $2`,
          [sessionId, candidate.id]
        );
        if (sessionCheck.rows.length === 0) {
          res.status(400).json({ error: "Invalid sessionId" });
          return;
        }
      }

      const signalId = uuidv4();
      await pool.query(
        `INSERT INTO behavioral_signals (id, candidate_id, assessment_id, session_id, signal_type, data, recorded_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          signalId,
          candidate.id,
          candidate.assessment_id,
          sessionId || null,
          signalType,
          JSON.stringify(data),
        ]
      );

      // Get count of signals for this candidate
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM behavioral_signals
         WHERE candidate_id = $1 AND assessment_id = $2`,
        [candidate.id, candidate.assessment_id]
      );

      res.status(201).json({
        signalId,
        signalType,
        totalSignals: parseInt(countResult.rows[0].total, 10),
      });
    } catch (err) {
      console.error("Error recording behavioral signal:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/candidate/behavioral/batch - Submit multiple behavioral signals at once
router.post(
  "/api/candidate/behavioral/batch",
  candidateAuth,
  async (req: CandidateRequest, res: Response) => {
    try {
      const candidate = req.candidate!;
      const { signals } = req.body;

      if (!Array.isArray(signals) || signals.length === 0) {
        res.status(400).json({ error: "Field 'signals' is required and must be a non-empty array" });
        return;
      }

      if (signals.length > 100) {
        res.status(400).json({ error: "Maximum 100 signals per batch" });
        return;
      }

      // Validate all signals before inserting
      for (let i = 0; i < signals.length; i++) {
        const signal = signals[i];
        if (!signal.signalType || typeof signal.signalType !== "string") {
          res.status(400).json({ error: `Signal at index ${i}: 'signalType' is required and must be a string` });
          return;
        }
        if (!VALID_SIGNAL_TYPES.includes(signal.signalType)) {
          res.status(400).json({
            error: `Signal at index ${i}: invalid signalType. Must be one of: ${VALID_SIGNAL_TYPES.join(", ")}`,
          });
          return;
        }
        if (!signal.data || typeof signal.data !== "object" || Array.isArray(signal.data)) {
          res.status(400).json({ error: `Signal at index ${i}: 'data' is required and must be an object` });
          return;
        }
      }

      const pool = getPool();
      const insertedIds: string[] = [];

      for (const signal of signals) {
        const signalId = uuidv4();
        await pool.query(
          `INSERT INTO behavioral_signals (id, candidate_id, assessment_id, session_id, signal_type, data, recorded_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            signalId,
            candidate.id,
            candidate.assessment_id,
            signal.sessionId || null,
            signal.signalType,
            JSON.stringify(signal.data),
          ]
        );
        insertedIds.push(signalId);
      }

      res.status(201).json({
        inserted: insertedIds.length,
        signalIds: insertedIds,
      });
    } catch (err) {
      console.error("Error recording behavioral signals batch:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
