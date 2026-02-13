import { Pool } from "pg";
import { config } from "./config";

let pool: Pool = new Pool(config.database);

export function getPool(): Pool {
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
