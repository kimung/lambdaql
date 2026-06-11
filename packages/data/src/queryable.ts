import { expression, ConstantExpression, FieldExpression, type LambdaExpression } from '@gamn9/expression'
import { SourceExpression }                                  from './expression/source.js'
import { SelectExpression, JoinExpression, OrderExpression } from './expression/select.js'
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
  ) {}

  private get _select(): SelectExpression {
    if (this._expr.kind !== 'SelectExpression')
      throw new Error('Cannot chain query operations after union()')
    return this._expr as SelectExpression
  }

  filter(predicate: FnOrExpr<T>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ where: [...s.where, resolve(predicate)] }))
  }

  select<U>(selector: FnOrExpr<T>): Queryable<U> {
    return new Queryable<U>(this._select.patch({ selector: resolve(selector) }))
  }

  join<U, R = T & U>(other: Queryable<U>, on: FnOrExpr<T>): Queryable<R> {
    const s = this._select
    return new Queryable<R>(s.patch({ joins: [...s.joins, new JoinExpression(other._select.source, resolve(on), 'INNER')] }))
  }

  leftJoin<U, R = T & Partial<U>>(other: Queryable<U>, on: FnOrExpr<T>): Queryable<R> {
    const s = this._select
    return new Queryable<R>(s.patch({ joins: [...s.joins, new JoinExpression(other._select.source, resolve(on), 'LEFT')] }))
  }

  groupBy(selector: FnOrExpr<T>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ groups: [...s.groups, resolve(selector)] }))
  }

  having(predicate: FnOrExpr<T>): Queryable<T> {
    return new Queryable(this._select.patch({ having: resolve(predicate) }))
  }

  orderBy(selector: FnOrExpr<T>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ orders: [...s.orders, new OrderExpression(resolve(selector), 'ASC')] }))
  }

  orderByDesc(selector: FnOrExpr<T>): Queryable<T> {
    const s = this._select
    return new Queryable(s.patch({ orders: [...s.orders, new OrderExpression(resolve(selector), 'DESC')] }))
  }

  take(n: number): Queryable<T> {
    return new Queryable(this._select.patch({ limitVal: n }))
  }

  skip(n: number): Queryable<T> {
    return new Queryable(this._select.patch({ skipVal: n }))
  }

  distinct(): Queryable<T> {
    return new Queryable(this._select.patch({ isDistinct: true }))
  }

  union<U = T>(other: Queryable<U>): Queryable<T> {
    return new Queryable<T>(new UnionExpression(this._expr, other._expr, false))
  }

  unionAll<U = T>(other: Queryable<U>): Queryable<T> {
    return new Queryable<T>(new UnionExpression(this._expr, other._expr, true))
  }

  toSql(): SqlResult {
    const t = new SqlTranslator()
    if (this._expr.kind === 'UnionExpression')
      return t.translateUnion(this._expr as UnionExpression)
    return t.translateSelect(this._expr as SelectExpression)
  }
}

export function insertInto<T extends object>(table: string, record: T): SqlResult {
  const source = new SourceExpression(table)
  const fields = Object.entries(record).map(
    ([name, value]) => new FieldExpression(name, new ConstantExpression(value as any)),
  )
  return new SqlTranslator().translateInsert(new InsertExpression(source, fields))
}

export function updateIn<T extends object>(
  table: string,
  record: Partial<T>,
  where?: (x: T) => boolean,
): SqlResult {
  const source = new SourceExpression(table)
  const fields = Object.entries(record).map(
    ([name, value]) => new FieldExpression(name, new ConstantExpression(value as any)),
  )
  const whereExpr = where ? expression.lambda.parse(where) : undefined
  return new SqlTranslator().translateUpdate(new UpdateExpression(source, fields, whereExpr))
}

export function deleteFrom<T>(table: string, where: (x: T) => boolean): SqlResult {
  const source    = new SourceExpression(table)
  const whereExpr = expression.lambda.parse(where)
  return new SqlTranslator().translateDelete(new DeleteExpression(source, whereExpr))
}
