import { Pool } from "pg";
import { config } from "../config";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export async function pingDatabase(): Promise<boolean> {
  const result = await pool.query("SELECT 1");
  return result.rows.length > 0;
}
