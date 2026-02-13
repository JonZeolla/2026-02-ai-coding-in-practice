import { Pool, PoolConfig } from "pg";
import { config } from "./config";

export function createPool(overrides?: Partial<PoolConfig>): Pool {
  return new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password,
    ...overrides,
  });
}

export interface JobRow {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

export async function markJobRunning(pool: Pool, jobId: string): Promise<void> {
  await pool.query(
    `UPDATE jobs SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [jobId]
  );
}

export async function markJobCompleted(
  pool: Pool,
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  await pool.query(
    `UPDATE jobs SET status = 'completed', result = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(result), jobId]
  );
}

export async function markJobFailed(
  pool: Pool,
  jobId: string,
  error: string
): Promise<void> {
  await pool.query(
    `UPDATE jobs SET status = 'failed', error = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [error, jobId]
  );
}

export async function getJob(
  pool: Pool,
  jobId: string
): Promise<JobRow | null> {
  const res = await pool.query<JobRow>(`SELECT * FROM jobs WHERE id = $1`, [
    jobId,
  ]);
  return res.rows[0] || null;
}
