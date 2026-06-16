import type { Pool, PoolClient } from "pg";
import { postgres, type Executor, type TransactionalExecutor } from "@lambdaql/data";

export function createPgExecutor(pool: Pool): TransactionalExecutor {
  return {
    dialect: postgres,
    async query(sql: string, params: unknown[]) {
      const result = await pool.query(sql, params as any[]);
      return { rows: result.rows };
    },
    async transaction<R>(cb: (exec: Executor) => Promise<R>): Promise<R> {
      const client: PoolClient = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await cb({
          dialect: postgres,
          async query(sql: string, params: unknown[]) {
            return { rows: (await client.query(sql, params as any[])).rows };
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
