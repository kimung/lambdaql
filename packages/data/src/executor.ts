import type { Dialect } from "./sql/dialect.js";
import type { NamingStrategy } from "./naming.js";

export interface Executor {
  readonly dialect: Dialect;
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface TransactionalExecutor extends Executor {
  transaction<R>(cb: (exec: Executor) => Promise<R>): Promise<R>;
}

export interface QueryContext {
  readonly executor: Executor;
  readonly naming?: NamingStrategy;
}
