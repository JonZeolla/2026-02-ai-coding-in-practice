import { Pool, PoolConfig } from "pg";
import { config } from "./config";

let pool: Pool;

export function getPool(overrideConfig?: PoolConfig): Pool {
  if (!pool) {
    pool = new Pool(overrideConfig || config.database);
  }
  return pool;
}

export function setPool(newPool: Pool): void {
  pool = newPool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}
