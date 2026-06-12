import type {
  Expression, LambdaExpression, NameExpression, ConstantExpression,
  BinaryExpression, UnaryExpression, PropertyExpression, MethodExpression,
  FieldExpression, ObjectLiteralExpression, ConditionalExpression, NullishExpression,
  ArrayLiteralExpression,
} from '@gamn9/expression'
import type { SelectExpression, JoinExpression } from '../expression/select.js'
import type { UnionExpression }                  from '../expression/union.js'
import type { SubqueryCondition }               from '../expression/subquery.js'
import type { InsertExpression }                 from '../expression/insert.js'
import type { UpdateExpression }                 from '../expression/update.js'
import type { DeleteExpression }                 from '../expression/delete.js'
import { identityNaming, type NamingStrategy }   from '../naming.js'

export interface SqlResult {
  sql:    string
  params: unknown[]
}

const SQL_OPS: Record<string, string> = {
  '&&': 'AND', '||': 'OR',
  '===': '=', '!==': '!=', '==': '=', '!=': '!=',
  '<': '<', '<=': '<=', '>': '>', '>=': '>=',
  '+': '+', '-': '-', '*': '*', '/': '/',
}

export class SqlTranslator {
  private _params: unknown[] = []
  private _aliases: string[] = []

  constructor(private readonly naming: NamingStrategy = identityNaming) {}

  private addParam(value: unknown): string {
    this._params.push(value)
    return `$${this._params.length}`
  }

  translateSelect(expr: SelectExpression): SqlResult {
    this._params = []
    this._aliases = ['t0', ...expr.joins.map((_, i) => `t${i + 1}`)]

    const distinct = expr.isDistinct ? ' DISTINCT' : ''
    const columns  = this.columns(expr)
    const source   = `${expr.source.name} AS t0`
    const joins    = expr.joins.length
      ? ' ' + expr.joins.map((j, i) => this.join(j, i + 1)).join(' ')
      : ''
    const whereParts = [
      ...expr.where.map(l => this.lambdaBody(l)),
      ...expr.subqueries.map(s => this.subqueryCond(s)),
    ]
    const where  = whereParts.length ? ' WHERE ' + whereParts.join(' AND ') : ''
    const group  = expr.groups.length
      ? ' GROUP BY ' + expr.groups.map(l => this.lambdaBody(l)).join(', ')
      : ''
    const having = expr.having
      ? ' HAVING ' + this.lambdaBody(expr.having)
      : ''
    const order  = expr.orders.length
      ? ' ORDER BY ' + expr.orders.map(o => `${this.lambdaBody(o.selector)} ${o.direction}`).join(', ')
      : ''
    const limit  = expr.limitVal != null ? ` LIMIT ${expr.limitVal}` : ''
    const offset = expr.skipVal  != null ? ` OFFSET ${expr.skipVal}` : ''

    return {
      sql: `SELECT${distinct} ${columns} FROM ${source}${joins}${where}${group}${having}${order}${limit}${offset}`,
      params: this._params,
    }
  }

  translateInsert(expr: InsertExpression): SqlResult {
    this._params = []
    const columns = expr.fields.map(f => f.name).join(', ')
    const values  = expr.fields
      .map(f => this.addParam((f.assignment as ConstantExpression).value))
      .join(', ')
    return {
      sql: `INSERT INTO ${expr.source.name} (${columns}) VALUES (${values})`,
      params: this._params,
    }
  }

  translateUpdate(expr: UpdateExpression): SqlResult {
    this._params = []
    const set = expr.fields
      .map(f => `${f.name} = ${this.addParam((f.assignment as ConstantExpression).value)}`)
      .join(', ')
    const where = expr.where
      ? ` WHERE ${this.dmlCondition(expr.where)}`
      : ''
    return {
      sql: `UPDATE ${expr.source.name} SET ${set}${where}`,
      params: this._params,
    }
  }

  translateDelete(expr: DeleteExpression): SqlResult {
    this._params = []
    return {
      sql: `DELETE FROM ${expr.source.name} WHERE ${this.dmlCondition(expr.where)}`,
      params: this._params,
    }
  }

  translateUnion(expr: UnionExpression): SqlResult {
    this._params = []
    const sql = this.buildUnion(expr)
    return { sql, params: this._params }
  }

  // ── private helpers ─────────────────────────────────────────────────────────

  private columns(expr: SelectExpression): string {
    if (!expr.selector) return '*'
    const aliases = this.aliasMap(expr.selector)
    const body = expr.selector.body
    // Projection scalaire : select(u => u.name) → une seule colonne, sans AS
    if (body.kind !== 'ObjectLiteralExpression')
      return this.expr(body, aliases)
    const obj = body as ObjectLiteralExpression
    return obj.fields.map((f: FieldExpression) => `${this.expr(f.assignment, aliases)} AS ${f.name}`).join(', ')
  }

  private join(join: JoinExpression, idx: number): string {
    const target  = `${join.source.name} AS t${idx}`
    const aliases = this.joinAliasMap(join.predicate, idx)
    return `${join.type} JOIN ${target} ON ${this.expr(join.predicate.body, aliases)}`
  }

  // Le prédicat de join s'écrit (sourceRow, jointeRow) => … : le 1er arg réfère la
  // source (t0), le dernier la table jointe (t{idx}). Un mapping positionnel naïf
  // depuis t0 casserait dès le 2e join (la jointe serait aliasée t1 au lieu de t{idx}).
  private joinAliasMap(lambda: LambdaExpression, idx: number): Map<string, string> {
    const map = new Map<string, string>()
    const args = lambda.args
    args.forEach((arg: NameExpression, i: number) => {
      map.set(arg.name, i === args.length - 1 ? `t${idx}` : (this._aliases[i] ?? `t${i}`))
    })
    return map
  }

  private aliasMap(lambda: LambdaExpression): Map<string, string> {
    return new Map(lambda.args.map((arg: NameExpression, i: number) => [arg.name, this._aliases[i] ?? `t${i}`]))
  }

  private lambdaBody(lambda: LambdaExpression): string {
    return this.expr(lambda.body, this.aliasMap(lambda))
  }

  private dmlCondition(lambda: LambdaExpression): string {
    const aliases = new Map(lambda.args.map((a: NameExpression) => [a.name, '']))
    return this.expr(lambda.body, aliases)
  }

  private expr(node: Expression, aliases: Map<string, string>): string {
    switch (node.kind) {
      case 'NameExpression': {
        const n = node as NameExpression
        return aliases.get(n.name) ?? n.name
      }

      case 'ConstantExpression': {
        const c = node as ConstantExpression
        if (c.value === null || c.value === undefined) return 'NULL'
        return this.addParam(c.value)
      }

      case 'BinaryExpression': {
        const b = node as BinaryExpression
        // NULL comparisons → IS NULL / IS NOT NULL
        if (b.right.kind === 'ConstantExpression') {
          const rv = (b.right as ConstantExpression).value
          if (rv === null || rv === undefined) {
            const left = this.expr(b.left, aliases)
            if (b.operator === '===' || b.operator === '==')  return `${left} IS NULL`
            if (b.operator === '!==' || b.operator === '!=')  return `${left} IS NOT NULL`
          }
        }
        if (b.operator === '%') {
          return `MOD(${this.expr(b.left, aliases)}, ${this.expr(b.right, aliases)})`
        }
        // '??' est produit comme BinaryExpression par le parser et le compiler → COALESCE
        if (b.operator === '??') {
          return `COALESCE(${this.expr(b.left, aliases)}, ${this.expr(b.right, aliases)})`
        }
        const op = SQL_OPS[b.operator] ?? b.operator
        return `(${this.expr(b.left, aliases)} ${op} ${this.expr(b.right, aliases)})`
      }

      case 'UnaryExpression': {
        const u = node as UnaryExpression
        const operand = this.expr(u.operand, aliases)
        return u.operator === '!' ? `NOT (${operand})` : `${u.operator}${operand}`
      }

      case 'PropertyExpression': {
        const p = node as PropertyExpression
        if (p.property === 'length') return `LENGTH(${this.expr(p.context, aliases)})`
        const col = this.naming(p.property)
        if (p.context.kind === 'NameExpression') {
          const alias = aliases.get((p.context as NameExpression).name)
          if (alias === '')          return col            // DML: bare column
          if (alias !== undefined)   return `${alias}.${col}` // SELECT: t0.column
        }
        return `${this.expr(p.context, aliases)}.${col}`
      }

      case 'ArrayLiteralExpression': {
        const a = node as ArrayLiteralExpression
        return `(${a.elements.map(e => this.expr(e, aliases)).join(', ')})`
      }

      case 'MethodExpression': {
        const m = node as MethodExpression
        // [1, 2, 3].includes(u.id) → u.id IN ($1, $2, $3)
        if (m.method === 'includes' && m.context.kind === 'ArrayLiteralExpression') {
          const arr  = m.context as ArrayLiteralExpression
          const val  = this.expr(m.args[0]!, aliases)
          const list = arr.elements.map(e => this.expr(e, aliases)).join(', ')
          return `${val} IN (${list})`
        }
        const ctx = this.expr(m.context, aliases)
        switch (m.method) {
          case 'includes':   return `${ctx} LIKE ${this.addParam(`%${this.likeVal(m.args[0])}%`)}`
          case 'startsWith': return `${ctx} LIKE ${this.addParam(`${this.likeVal(m.args[0])}%`)}`
          case 'endsWith':   return `${ctx} LIKE ${this.addParam(`%${this.likeVal(m.args[0])}`)}`
          case 'toLowerCase': return `LOWER(${ctx})`
          case 'toUpperCase': return `UPPER(${ctx})`
          case 'trim':        return `TRIM(${ctx})`
          case 'replace':     return `REPLACE(${ctx}, ${this.expr(m.args[0]!, aliases)}, ${this.expr(m.args[1]!, aliases)})`
          case 'count': case 'min': case 'max': case 'avg': case 'sum':
            return `${m.method.toUpperCase()}(${ctx})`
          default:
            throw new Error(`Unsupported method: ${m.method}`)
        }
      }

      case 'ConditionalExpression': {
        const c = node as ConditionalExpression
        return `CASE WHEN ${this.expr(c.condition, aliases)} THEN ${this.expr(c.consequent, aliases)} ELSE ${this.expr(c.alternate, aliases)} END`
      }

      case 'NullishExpression': {
        const n = node as NullishExpression
        return `COALESCE(${this.expr(n.left, aliases)}, ${this.expr(n.right, aliases)})`
      }

      case 'LambdaExpression':
        return this.lambdaBody(node as LambdaExpression)

      default:
        throw new Error(`Unsupported expression kind: ${(node as any).kind}`)
    }
  }

  private buildUnion(expr: UnionExpression): string {
    const buildSide = (side: SelectExpression | UnionExpression): string => {
      if (side.kind === 'UnionExpression') return this.buildUnion(side as UnionExpression)
      // Each SELECT side needs fresh aliases but shared params accumulator.
      // Use a child translator to generate the SQL, then re-index its $n params.
      const child  = new SqlTranslator(this.naming)
      const result = child.translateSelect(side as SelectExpression)
      const offset = this._params.length
      this._params.push(...result.params)
      return offset === 0
        ? result.sql
        : result.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n, 10) + offset}`)
    }
    const left  = buildSide(expr.left)
    const right = buildSide(expr.right)
    const op    = expr.all ? 'UNION ALL' : 'UNION'
    return `(${left}) ${op} (${right})`
  }

  private subqueryCond(cond: SubqueryCondition): string {
    const inner = this.buildSubquery(cond.inner)
    if (cond.op === 'EXISTS' || cond.op === 'NOT EXISTS')
      return `${cond.op} (${inner})`
    const field = this.lambdaBody(cond.field!)
    return `${field} ${cond.op} (${inner})`
  }

  private buildSubquery(inner: SelectExpression | UnionExpression): string {
    const child  = new SqlTranslator(this.naming)
    const result = inner.kind === 'UnionExpression'
      ? child.translateUnion(inner as UnionExpression)
      : child.translateSelect(inner as SelectExpression)
    const offset = this._params.length
    this._params.push(...result.params)
    return offset === 0
      ? result.sql
      : result.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n, 10) + offset}`)
  }

  private likeVal(arg: Expression | undefined): string {
    if (!arg || arg.kind !== 'ConstantExpression')
      throw new Error('LIKE argument must be a string constant')
    return String((arg as ConstantExpression).value)
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
  }
}
