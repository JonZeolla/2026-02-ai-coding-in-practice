import { Request, Response, NextFunction } from "express";
import { getPool } from "../db";

export interface CandidateRequest extends Request {
  candidate?: {
    id: string;
    assessment_id: string;
    name: string;
    email: string;
    status: string;
  };
}

export async function candidateAuth(
  req: CandidateRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token =
    req.headers["x-candidate-token"] as string | undefined ||
    (req.query.token as string | undefined);

  if (!token) {
    res.status(401).json({ error: "Missing candidate token" });
    return;
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      "SELECT id, assessment_id, name, email, status FROM candidates WHERE access_token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid candidate token" });
      return;
    }

    req.candidate = result.rows[0];
    next();
  } catch (err) {
    console.error("Error in candidate auth:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
