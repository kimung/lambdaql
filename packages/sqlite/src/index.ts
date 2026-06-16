import type { Database } from "better-sqlite3";
import { sqlite, type Executor } from "@gamn9/data";

export function createSqliteExecutor(db: Database): Executor {
  return {
    dialect: sqlite,
    query(sql: string, params: unknown[]) {
      // better-sqlite3 est synchrone — on enveloppe dans une Promise
      const rows = db.prepare(sql).all(params as any[]);
      return Promise.resolve({ rows });
    },
  };
}
