import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "../db";
import crypto from "crypto";

const router = Router();

// POST /api/assessments - Create an assessment
router.post("/api/assessments", async (req: Request, res: Response) => {
  try {
    const { title, description, role, rubric, config, created_by } = req.body;

    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "Field 'title' is required and must be a string" });
      return;
    }
    if (!role || typeof role !== "string") {
      res.status(400).json({ error: "Field 'role' is required and must be a string" });
      return;
    }

    const id = uuidv4();
    const pool = getPool();

    await pool.query(
      `INSERT INTO assessments (id, title, description, role, rubric, config, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        id,
        title,
        description || null,
        role,
        JSON.stringify(rubric || {}),
        JSON.stringify(config || {}),
        created_by || null,
      ]
    );

    res.status(201).json({
      id,
      title,
      description: description || null,
      role,
      rubric: rubric || {},
      config: config || {},
      status: "draft",
      created_by: created_by || null,
    });
  } catch (err) {
    console.error("Error creating assessment:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/assessments - List assessments
router.get("/api/assessments", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const pool = getPool();

    let query = "SELECT * FROM assessments";
    const params: string[] = [];

    if (status && typeof status === "string") {
      query += " WHERE status = $1";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error listing assessments:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/assessments/:id - Get assessment detail
router.get("/api/assessments/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query("SELECT * FROM assessments WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Assessment not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error getting assessment:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assessments/:id/invite - Invite a candidate
router.post("/api/assessments/:id/invite", async (req: Request, res: Response) => {
  try {
    const { id: assessmentId } = req.params;
    const { name, email, metadata } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Field 'name' is required and must be a string" });
      return;
    }
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "Field 'email' is required and must be a string" });
      return;
    }

    const pool = getPool();

    // Verify the assessment exists
    const assessmentResult = await pool.query(
      "SELECT id FROM assessments WHERE id = $1",
      [assessmentId]
    );
    if (assessmentResult.rows.length === 0) {
      res.status(404).json({ error: "Assessment not found" });
      return;
    }

    const candidateId = uuidv4();
    const accessToken = crypto.randomBytes(32).toString("hex");

    await pool.query(
      `INSERT INTO candidates (id, assessment_id, name, email, access_token, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        candidateId,
        assessmentId,
        name,
        email,
        accessToken,
        JSON.stringify(metadata || {}),
      ]
    );

    res.status(201).json({
      id: candidateId,
      assessment_id: assessmentId,
      name,
      email,
      access_token: accessToken,
      status: "invited",
      metadata: metadata || {},
    });
  } catch (err) {
    console.error("Error inviting candidate:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
