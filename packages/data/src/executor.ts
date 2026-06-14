import type { Dialect } from './sql/dialect.js'
import type { NamingStrategy } from './naming.js'

export interface Executor {
  readonly dialect: Dialect
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>
}

export interface QueryContext {
  readonly executor: Executor
  readonly naming?: NamingStrategy
}
