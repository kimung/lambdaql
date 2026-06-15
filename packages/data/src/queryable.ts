import { expression, ConstantExpression, FieldExpression, type LambdaExpression } from '@gamn9/expression'
import { type NamingStrategy } from './naming.js'
import { type Dialect }        from './sql/dialect.js'
import { type Executor, type QueryContext } from './executor.js'
import { RawExpression }                    from './expression/raw.js'
import { CteExpression }                    from './expression/cte.js'
import { SourceExpression }                                  from './expression/source.js'
import { SelectExpression, JoinExpression, OrderExpression } from './expression/select.js'
import { SubqueryCondition }                                  from './expression/subquery.js'
import { UnionExpression }                                    from './expression/union.js'
import { InsertExpression }                                   from './expression/insert.js'
import { UpdateExpression }                                   from './expression/update.js'
import { DeleteExpression }                                   from './expression/delete.js'
import { SqlTranslator, type SqlResult }                      from './sql/translator.js'

type Fn<T> = (x: T, ...rest: any[]) => unknown
type FnOrExpr<T> = Fn<T> | LambdaExpression

function resolve<T>(v: FnOrExpr<T>): LambdaExpression {
  return typeof v === 'function' ? expression.lambda.parse(v as Fn<unknown>) : v
}

export function from<T>(table: string): Queryable<T> {
  return new Queryable<T>(new SelectExpression(new SourceExpression(table)))
}

export class Queryable<T> {
  constructor(
    /** @internal */
    public readonly _expr: SelectExpression | UnionExpression,
    /** @internal */
    public readonly _ctx?: QueryContext,
  ) {}

  private get _select(): SelectExpression {
    if (this._expr.kind !== 'SelectExpression')
      throw new Error('Cannot chain query operations after union()')
    return this._expr as SelectExpression
  }

  filter(predicate: FnOrExpr<T>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ where: [...s.where, resolve(predicate)] }), this._ctx)
  }

  select<U>(selector: FnOrExpr<T>): Queryable<U> {
    return new Queryable<U>(this._select.patch({ selector: resolve(selector) }), this._ctx)
  }

  join<U, R = T & U>(other: Queryable<U>, on: FnOrExpr<T>): Queryable<R> {
    const s = this._select
    return new Queryable<R>(s.patch({ joins: [...s.joins, new JoinExpression(other._select.source, resolve(on), 'INNER')] }), this._ctx)
  }

  leftJoin<U, R = T & Partial<U>>(other: Queryable<U>, on: FnOrExpr<T>): Queryable<R> {
    const s = this._select
    return new Queryable<R>(s.patch({ joins: [...s.joins, new JoinExpression(other._select.source, resolve(on), 'LEFT')] }), this._ctx)
  }

  groupBy(selector: FnOrExpr<T>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ groups: [...s.groups, resolve(selector)] }), this._ctx)
  }

  having(predicate: FnOrExpr<T>): Queryable<T> {
    return new Queryable(this._select.patch({ having: resolve(predicate) }), this._ctx)
  }

  orderBy(selector: FnOrExpr<T>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ orders: [...s.orders, new OrderExpression(resolve(selector), 'ASC')] }), this._ctx)
  }

  orderByDesc(selector: FnOrExpr<T>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ orders: [...s.orders, new OrderExpression(resolve(selector), 'DESC')] }), this._ctx)
  }

  take(n: number): Queryable<T> {
    return new Queryable(this._select.patch({ limitVal: n }), this._ctx)
  }

  skip(n: number): Queryable<T> {
    return new Queryable(this._select.patch({ skipVal: n }), this._ctx)
  }

  distinct(): Queryable<T> {
    return new Queryable(this._select.patch({ isDistinct: true }), this._ctx)
  }

  whereIn(selector: FnOrExpr<T>, inner: Queryable<any>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ subqueries: [...s.subqueries, new SubqueryCondition('IN', resolve(selector), inner._expr)] }), this._ctx)
  }

  whereNotIn(selector: FnOrExpr<T>, inner: Queryable<any>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ subqueries: [...s.subqueries, new SubqueryCondition('NOT IN', resolve(selector), inner._expr)] }), this._ctx)
  }

  whereExists(inner: Queryable<any>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ subqueries: [...s.subqueries, new SubqueryCondition('EXISTS', undefined, inner._expr)] }), this._ctx)
  }

  whereNotExists(inner: Queryable<any>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ subqueries: [...s.subqueries, new SubqueryCondition('NOT EXISTS', undefined, inner._expr)] }), this._ctx)
  }

  withCte<U>(name: string, query: Queryable<U>, opts?: { recursive?: boolean }): Queryable<T> {
    const s = this._select
    return new Queryable(
      s.patch({ ctes: [...s.ctes, new CteExpression(name, query._expr, opts?.recursive ?? false)] }),
      this._ctx,
    )
  }

  whereRaw(sql: string, ...params: unknown[]): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ rawWheres: [...s.rawWheres, new RawExpression(sql, params)] }), this._ctx)
  }

  havingRaw(sql: string, ...params: unknown[]): Queryable<T> {
    return new Queryable(this._select.patch({ rawHaving: new RawExpression(sql, params) }), this._ctx)
  }

  orderByRaw(sql: string, ...params: unknown[]): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ rawOrders: [...s.rawOrders, new RawExpression(sql, params)] }), this._ctx)
  }

  union<U = T>(other: Queryable<U>): Queryable<T> {
    return new Queryable<T>(new UnionExpression(this._expr, other._expr, false), this._ctx)
  }

  unionAll<U = T>(other: Queryable<U>): Queryable<T> {
    return new Queryable<T>(new UnionExpression(this._expr, other._expr, true), this._ctx)
  }

  toSql(options?: { naming?: NamingStrategy; dialect?: Dialect }): SqlResult {
    const t = new SqlTranslator(
      options?.naming ?? this._ctx?.naming,
      options?.dialect ?? this._ctx?.executor?.dialect,
    )
    if (this._expr.kind === 'UnionExpression')
      return t.translateUnion(this._expr as UnionExpression)
    return t.translateSelect(this._expr as SelectExpression)
  }

  // ── Méthodes terminales (nécessitent un Executor via createDatabase) ─────────

  async toArray(): Promise<T[]> {
    if (!this._ctx) throw new Error('toArray() requires an Executor — use createDatabase()')
    const { sql, params } = this.toSql()
    const result = await this._ctx.executor.query(sql, params)
    return result.rows as T[]
  }

  async first(): Promise<T> {
    const rows = await this.take(1).toArray()
    if (rows.length === 0) throw new Error('Sequence contains no elements')
    return rows[0]!
  }

  async firstOrDefault(): Promise<T | undefined> {
    const rows = await this.take(1).toArray()
    return rows[0]
  }

  async count(): Promise<number> {
    if (!this._ctx) throw new Error('count() requires an Executor — use createDatabase()')
    // Retire ORDER BY : illégal dans certains contextes de sous-requête wrappée
    const base: Queryable<T> = this._expr.kind === 'SelectExpression'
      ? new Queryable<T>((this._expr as SelectExpression).patch({ orders: [], rawOrders: [] }), this._ctx)
      : this
    const { sql: innerSql, params } = base.toSql()
    const sql = `SELECT COUNT(*) AS count FROM (${innerSql}) AS sub`
    const result = await this._ctx.executor.query(sql, params)
    const row = result.rows[0] as any
    return Number(row?.count ?? row?.['COUNT(*)'] ?? 0)
  }

  async any(): Promise<boolean> {
    const rows = await this.take(1).toArray()
    return rows.length > 0
  }
}

// ── createDatabase ───────────────────────────────────────────────────────────

export interface Database {
  from<T>(table: string): Queryable<T>
  insertInto<T extends object>(table: string, record: T): Promise<void>
  updateIn<T extends object>(table: string, record: Partial<T>, where?: (x: T) => boolean): Promise<void>
  deleteFrom<T>(table: string, where: (x: T) => boolean): Promise<void>
}

export function createDatabase(
  executor: Executor,
  opts?: { naming?: NamingStrategy },
): Database {
  const ctx: QueryContext = { executor, naming: opts?.naming }
  const dmlOpts = { naming: opts?.naming, dialect: executor.dialect }
  return {
    from<T>(table: string): Queryable<T> {
      return new Queryable<T>(new SelectExpression(new SourceExpression(table)), ctx)
    },
    async insertInto<T extends object>(table: string, record: T): Promise<void> {
      const { sql, params } = insertInto(table, record, dmlOpts)
      await executor.query(sql, params)
    },
    async updateIn<T extends object>(table: string, record: Partial<T>, where?: (x: T) => boolean): Promise<void> {
      const { sql, params } = updateIn(table, record, where, dmlOpts)
      await executor.query(sql, params)
    },
    async deleteFrom<T>(table: string, where: (x: T) => boolean): Promise<void> {
      const { sql, params } = deleteFrom(table, where, dmlOpts)
      await executor.query(sql, params)
    },
  }
}

// ── Helpers DML ──────────────────────────────────────────────────────────────

export function insertInto<T extends object>(
  table: string,
  record: T,
  options?: { naming?: NamingStrategy; dialect?: Dialect },
): SqlResult {
  const source = new SourceExpression(table)
  const fields = Object.entries(record).map(
    ([name, value]) => new FieldExpression(name, new ConstantExpression(value as any)),
  )
  return new SqlTranslator(options?.naming, options?.dialect).translateInsert(new InsertExpression(source, fields))
}

export function updateIn<T extends object>(
  table: string,
  record: Partial<T>,
  where?: (x: T) => boolean,
  options?: { naming?: NamingStrategy; dialect?: Dialect },
): SqlResult {
  const source = new SourceExpression(table)
  const fields = Object.entries(record).map(
    ([name, value]) => new FieldExpression(name, new ConstantExpression(value as any)),
  )
  const whereExpr = where ? expression.lambda.parse(where) : undefined
  return new SqlTranslator(options?.naming, options?.dialect).translateUpdate(new UpdateExpression(source, fields, whereExpr))
}

export function deleteFrom<T>(
  table: string,
  where: (x: T) => boolean,
  options?: { naming?: NamingStrategy; dialect?: Dialect },
): SqlResult {
  const source    = new SourceExpression(table)
  const whereExpr = expression.lambda.parse(where)
  return new SqlTranslator(options?.naming, options?.dialect).translateDelete(new DeleteExpression(source, whereExpr))
}
