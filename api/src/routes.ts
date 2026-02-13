import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "./db";
import { getQueue } from "./queue";

const router = Router();

// POST /api/jobs - Submit a new job
router.post("/api/jobs", async (req: Request, res: Response) => {
  try {
    const { type, payload } = req.body;

    if (!type || typeof type !== "string") {
      res.status(400).json({ error: "Field 'type' is required and must be a string" });
      return;
    }

    const id = uuidv4();
    const jobPayload = payload || {};

    const pool = getPool();
    await pool.query(
      `INSERT INTO jobs (id, type, status, payload, created_at, updated_at)
       VALUES ($1, $2, 'pending', $3, NOW(), NOW())`,
      [id, type, JSON.stringify(jobPayload)]
    );

    // Add to BullMQ queue
    const queue = getQueue();
    await queue.add(type, { jobId: id, ...jobPayload }, { jobId: id });

    res.status(201).json({
      id,
      type,
      status: "pending",
      payload: jobPayload,
    });
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs - List jobs with optional status filter
router.get("/api/jobs", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const pool = getPool();

    let query = "SELECT * FROM jobs";
    const params: string[] = [];

    if (status && typeof status === "string") {
      query += " WHERE status = $1";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error listing jobs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/:id - Get job detail
router.get("/api/jobs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query("SELECT * FROM jobs WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error getting job:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
