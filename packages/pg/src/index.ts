import type { Pool } from "pg";
import { postgres, type Executor } from "@gamn9/data";

export function createPgExecutor(pool: Pool): Executor {
  return {
    dialect: postgres,
    async query(sql: string, params: unknown[]) {
      const result = await pool.query(sql, params as any[]);
      return { rows: result.rows };
    },
  };
}
