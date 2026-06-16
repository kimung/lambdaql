import type { Database as Sqlite3Db } from "better-sqlite3";
import { sqlite, type Executor, type TransactionalExecutor } from "@lambdaql/data";

function execQuery(db: Sqlite3Db, sql: string, params: unknown[]): { rows: unknown[] } {
  const stmt = db.prepare(sql);
  const rows = stmt.reader ? stmt.all(params as any[]) : (stmt.run(params as any[]), []);
  return { rows };
}

export function createSqliteExecutor(db: Sqlite3Db): TransactionalExecutor {
  return {
    dialect: sqlite,
    query(sql: string, params: unknown[]) {
      return Promise.resolve(execQuery(db, sql, params));
    },
    async transaction<R>(cb: (exec: Executor) => Promise<R>): Promise<R> {
      db.exec("BEGIN");
      try {
        const result = await cb({
          dialect: sqlite,
          query(sql: string, params: unknown[]) {
            return Promise.resolve(execQuery(db, sql, params));
          },
        });
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
