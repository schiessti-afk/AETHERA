import { Pool } from "pg";
import { config } from "../config";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

pool.on("error", (error) => {
  console.error("api postgres error", error.message);
});

export async function pingDatabase(): Promise<boolean> {
  const result = await pool.query("SELECT 1");
  return result.rows.length > 0;
}
