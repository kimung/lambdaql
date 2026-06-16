import type {
  Expression,
  LambdaExpression,
  NameExpression,
  ConstantExpression,
  BinaryExpression,
  UnaryExpression,
  PropertyExpression,
  MethodExpression,
  ConditionalExpression,
  NullishExpression,
  ArrayLiteralExpression,
} from "@lambdaql/expression";
import { identityNaming, SqlTranslator, mysql, type NamingStrategy, type Queryable } from "@lambdaql/data";
import type { SelectExpression, SubqueryCondition } from "@lambdaql/data";
import type { MikroORM, EntityManager, EntityName } from "@mikro-orm/core";

interface IQueryBuilder {
  readonly alias: string;
  andWhere(cond: string, params?: unknown[]): this;
  orderBy(orderBy: Record<string, "ASC" | "DESC">): this;
  groupBy(fields: string | string[]): this;
  having(cond: string, params?: unknown[]): this;
  limit(limit: number): this;
  offset(offset: number): this;
  join(field: string, alias: string): this;
  leftJoin(field: string, alias: string): this;
}

// ── Collecte des chaînes de navigation dans les lambdas (depth-N) ───────────

// Retourne la chaîne de segments depuis rootParam, ou null si ce n'est pas une nav chain.
// u.company.country.name → ['company', 'country', 'name']
function extractPropertyChain(node: PropertyExpression, rootParam: string): string[] | null {
  const segments: string[] = [node.property];
  let cur: Expression = node.context;
  while (cur.kind === "PropertyExpression") {
    segments.unshift((cur as PropertyExpression).property);
    cur = (cur as PropertyExpression).context;
  }
  if (cur.kind !== "NameExpression" || (cur as NameExpression).name !== rootParam) return null;
  return segments;
}

// Collecte toutes les chaînes à joindre (préfixes triés par longueur croissante).
// u.company.country.name → [['company'], ['company','country']]
function collectNavigationChains(se: SelectExpression): string[][] {
  const lambdas: LambdaExpression[] = [
    ...se.where,
    ...se.orders.map((o) => o.selector),
    ...se.groups,
    ...(se.having ? [se.having] : []),
  ];
  const seen = new Set<string>();
  const chains: string[][] = [];
  for (const l of lambdas) {
    const rootParam = (l.args[0] as NameExpression | undefined)?.name;
    if (rootParam) walkNavChains(l.body, rootParam, seen, chains);
  }
  return chains;
}

function walkNavChains(node: Expression, rootParam: string, seen: Set<string>, result: string[][]): void {
  switch (node.kind) {
    case "PropertyExpression": {
      const p = node as PropertyExpression;
      const chain = extractPropertyChain(p, rootParam);
      if (chain && chain.length >= 2) {
        for (let i = 1; i < chain.length; i++) {
          const key = chain.slice(0, i).join(".");
          if (!seen.has(key)) {
            seen.add(key);
            result.push(chain.slice(0, i));
          }
        }
      }
      walkNavChains(p.context, rootParam, seen, result);
      break;
    }
    case "BinaryExpression": {
      const b = node as BinaryExpression;
      walkNavChains(b.left, rootParam, seen, result);
      walkNavChains(b.right, rootParam, seen, result);
      break;
    }
    case "UnaryExpression":
      walkNavChains((node as UnaryExpression).operand, rootParam, seen, result);
      break;
    case "MethodExpression": {
      const m = node as MethodExpression;
      walkNavChains(m.context, rootParam, seen, result);
      for (const a of m.args) walkNavChains(a, rootParam, seen, result);
      break;
    }
    case "ConditionalExpression": {
      const c = node as ConditionalExpression;
      walkNavChains(c.condition, rootParam, seen, result);
      walkNavChains(c.consequent, rootParam, seen, result);
      walkNavChains(c.alternate, rootParam, seen, result);
      break;
    }
    case "NullishExpression": {
      const n = node as NullishExpression;
      walkNavChains(n.left, rootParam, seen, result);
      walkNavChains(n.right, rootParam, seen, result);
      break;
    }
    case "ArrayLiteralExpression":
      for (const e of (node as ArrayLiteralExpression).elements) walkNavChains(e, rootParam, seen, result);
      break;
  }
}

// ── Helper public : naming depuis la NamingStrategy MikroORM ────────────────

export function createNamingFromMikroOrm(orm: MikroORM, entityMeta?: any): NamingStrategy {
  const ns = orm.config.getNamingStrategy();
  return (prop) => {
    const fieldName = entityMeta?.props?.[prop]?.fieldNames?.[0];
    if (fieldName) return fieldName;
    return ns.propertyToColumnName(prop);
  };
}

// ── applyQueryable ───────────────────────────────────────────────────────────

export function applyQueryable<T extends object>(
  qb: IQueryBuilder,
  queryable: Queryable<T>,
  options?: {
    naming?: NamingStrategy;
    aliases?: Record<string, string>;
    em?: EntityManager;
    entity?: EntityName<T>;
  },
): IQueryBuilder {
  const expr = queryable._expr;
  if (expr.kind === "UnionExpression")
    throw new Error(
      "@lambdaql/mikro-orm: applyQueryable() ne supporte pas UNION — utilisez le QB MikroORM directement",
    );

  const se = expr as SelectExpression;
  const aliasOverrides = options?.aliases ?? {};

  // Dériver naming + entityMeta si em/entity fournis
  let naming = options?.naming;
  let entityMeta: any;
  if (options?.em && options?.entity) {
    entityMeta = options.em.getMetadata().get(options.entity as any);
    if (!naming) {
      const ns = options.em.config.getNamingStrategy();
      naming = (prop) => {
        const fieldName = entityMeta?.props?.[prop]?.fieldNames?.[0];
        if (fieldName) return fieldName;
        return ns.propertyToColumnName(prop);
      };
    }
  }
  naming ??= identityNaming;

  // Auto-join depth-N : traversée récursive via relation.targetMeta
  if (entityMeta) {
    const alreadyJoined = new Set<string>();
    for (const chain of collectNavigationChains(se)) {
      let prevAlias = qb.alias;
      let currentMeta = entityMeta;
      for (const segment of chain) {
        const relation = (currentMeta.relations as any[]).find((r: any) => r.name === segment);
        if (!relation) break;
        const joinAlias = aliasOverrides[segment] ?? segment;
        const joinKey = `${prevAlias}.${segment}`;
        if (!alreadyJoined.has(joinKey)) {
          qb.leftJoin(joinKey, joinAlias);
          alreadyJoined.add(joinKey);
        }
        currentMeta = relation.targetMeta;
        if (!currentMeta) break;
        prevAlias = joinAlias;
      }
    }
  }

  const builder = new MikroOrmConditionBuilder(qb.alias, naming, aliasOverrides);

  for (const pred of se.where) {
    const { condition, params } = builder.lambda(pred);
    qb.andWhere(condition, params);
  }

  for (const order of se.orders) {
    const { condition } = builder.lambda(order.selector);
    qb.orderBy({ [condition]: order.direction });
  }

  if (se.groups.length > 0) {
    qb.groupBy(se.groups.map((g) => builder.lambda(g).condition));
  }

  if (se.having) {
    const { condition, params } = builder.lambda(se.having);
    qb.having(condition, params);
  }

  for (const sub of se.subqueries) {
    const { condition, params } = subqueryToMikroOrm(sub, naming, builder);
    qb.andWhere(condition, params);
  }

  for (const raw of se.rawWheres) {
    qb.andWhere(raw.sql, raw.params as unknown[]);
  }

  if (se.rawHaving) {
    qb.having(se.rawHaving.sql, se.rawHaving.params as unknown[]);
  }

  if (se.rawOrders.length > 0) {
    throw new Error("@lambdaql/mikro-orm: orderByRaw() non supporté — utilisez qb.orderBy() directement");
  }

  if (se.ctes.length > 0) {
    throw new Error("@lambdaql/mikro-orm: withCte() non supporté — utilisez le QB MikroORM directement");
  }

  if (se.limitVal != null) qb.limit(se.limitVal);
  if (se.skipVal != null) qb.offset(se.skipVal);

  return qb;
}

// Traduit une SubqueryCondition en condition SQL avec ? params pour MikroORM QB.
function subqueryToMikroOrm(
  sub: SubqueryCondition,
  naming: NamingStrategy,
  builder: MikroOrmConditionBuilder,
): { condition: string; params: unknown[] } {
  // Le dialecte mysql utilise des placeholders '?' compatibles avec le QB MikroORM.
  const t = new SqlTranslator(naming, mysql);
  const result =
    sub.inner.kind === "UnionExpression" ? t.translateUnion(sub.inner as any) : t.translateSelect(sub.inner as any);
  const innerSql = result.sql;

  if (sub.op === "EXISTS" || sub.op === "NOT EXISTS")
    return { condition: `${sub.op} (${innerSql})`, params: result.params };

  const { condition: field, params: fieldParams } = builder.lambda(sub.field!);
  return {
    condition: `${field} ${sub.op} (${innerSql})`,
    params: [...fieldParams, ...result.params],
  };
}

// ── Traduction de l'AST gamn9 → SQL string avec ? (format MikroORM QB) ────────

const SQL_OPS: Record<string, string> = {
  "&&": "AND",
  "||": "OR",
  "===": "=",
  "!==": "!=",
  "==": "=",
  "!=": "!=",
  "<": "<",
  "<=": "<=",
  ">": ">",
  ">=": ">=",
  "+": "+",
  "-": "-",
  "*": "*",
  "/": "/",
};

class MikroOrmConditionBuilder {
  private _params: unknown[] = [];

  constructor(
    private readonly rootAlias: string,
    private readonly naming: NamingStrategy,
    private readonly aliasOverrides: Record<string, string> = {},
  ) {}

  lambda(expr: LambdaExpression): { condition: string; params: unknown[] } {
    this._params = [];
    const aliases = new Map<string, string>();
    for (let i = 0; i < expr.args.length; i++) {
      const name = (expr.args[i] as NameExpression).name;
      aliases.set(name, i === 0 ? this.rootAlias : (this.aliasOverrides[name] ?? name));
    }
    const condition = this.expr(expr.body, aliases);
    return { condition, params: this._params };
  }

  private addParam(value: unknown): string {
    this._params.push(value);
    return "?";
  }

  private expr(node: Expression, aliases: Map<string, string>): string {
    switch (node.kind) {
      case "NameExpression": {
        const n = node as NameExpression;
        return aliases.get(n.name) ?? n.name;
      }

      case "ConstantExpression": {
        const c = node as ConstantExpression;
        if (c.value === null || c.value === undefined) return "NULL";
        return this.addParam(c.value);
      }

      case "BinaryExpression": {
        const b = node as BinaryExpression;
        if (b.right.kind === "ConstantExpression") {
          const rv = (b.right as ConstantExpression).value;
          if (rv === null || rv === undefined) {
            const left = this.expr(b.left, aliases);
            if (b.operator === "===" || b.operator === "==") return `${left} IS NULL`;
            if (b.operator === "!==" || b.operator === "!=") return `${left} IS NOT NULL`;
          }
        }
        if (b.operator === "%") return `MOD(${this.expr(b.left, aliases)}, ${this.expr(b.right, aliases)})`;
        // '??' est produit comme BinaryExpression par le parser et le compiler → COALESCE
        if (b.operator === "??") return `COALESCE(${this.expr(b.left, aliases)}, ${this.expr(b.right, aliases)})`;
        const op = SQL_OPS[b.operator] ?? b.operator;
        return `(${this.expr(b.left, aliases)} ${op} ${this.expr(b.right, aliases)})`;
      }

      case "UnaryExpression": {
        const u = node as UnaryExpression;
        const operand = this.expr(u.operand, aliases);
        return u.operator === "!" ? `NOT (${operand})` : `${u.operator}${operand}`;
      }

      case "PropertyExpression": {
        const p = node as PropertyExpression;
        if (p.property === "length") return `LENGTH(${this.expr(p.context, aliases)})`;
        const col = this.naming(p.property);

        // Accès direct : u.col → alias.col
        if (p.context.kind === "NameExpression") {
          const alias = aliases.get((p.context as NameExpression).name);
          if (alias !== undefined) return `${alias}.${col}`;
        }

        // Navigation depth-N : u.a.b.c → deepestAlias.col
        const joinAlias = this.extractNavChain(p.context, aliases);
        if (joinAlias !== null) return `${joinAlias}.${col}`;

        return `${this.expr(p.context, aliases)}.${col}`;
      }

      case "ArrayLiteralExpression": {
        const a = node as ArrayLiteralExpression;
        return `(${a.elements.map((e) => this.expr(e, aliases)).join(", ")})`;
      }

      case "MethodExpression": {
        const m = node as MethodExpression;
        if (m.context.kind === "NameExpression" && (m.context as NameExpression).name === "Math") {
          const arg = this.expr(m.args[0]!, aliases);
          switch (m.method) {
            case "floor":
              return `FLOOR(${arg})`;
            case "ceil":
              return `CEIL(${arg})`;
            case "round":
              return `ROUND(${arg})`;
            case "abs":
              return `ABS(${arg})`;
          }
        }
        if (m.method === "includes" && m.context.kind === "ArrayLiteralExpression") {
          const arr = m.context as ArrayLiteralExpression;
          const val = this.expr(m.args[0]!, aliases);
          const list = arr.elements.map((e) => this.expr(e, aliases)).join(", ");
          return `${val} IN (${list})`;
        }
        if (m.method === "includes" && m.context.kind === "ConstantExpression") {
          const c = m.context as ConstantExpression;
          if (Array.isArray(c.value)) {
            const arr = c.value as unknown[];
            if (arr.length === 0) return "1 = 0";
            const val = this.expr(m.args[0]!, aliases);
            return `${val} IN (${arr.map((v) => this.addParam(v)).join(", ")})`;
          }
        }
        const ctx = this.expr(m.context, aliases);
        switch (m.method) {
          case "includes":
            return `${ctx} LIKE ${this.addParam(`%${this.likeVal(m.args[0])}%`)}`;
          case "startsWith":
            return `${ctx} LIKE ${this.addParam(`${this.likeVal(m.args[0])}%`)}`;
          case "endsWith":
            return `${ctx} LIKE ${this.addParam(`%${this.likeVal(m.args[0])}`)}`;
          case "toLowerCase":
            return `LOWER(${ctx})`;
          case "toUpperCase":
            return `UPPER(${ctx})`;
          case "trim":
            return `TRIM(${ctx})`;
          case "replace":
            return `REPLACE(${ctx}, ${this.expr(m.args[0]!, aliases)}, ${this.expr(m.args[1]!, aliases)})`;
          case "count":
          case "min":
          case "max":
          case "avg":
          case "sum":
            return `${m.method.toUpperCase()}(${ctx})`;
          case "getFullYear":
            return `EXTRACT(YEAR FROM ${ctx})`;
          case "getMonth":
            return `EXTRACT(MONTH FROM ${ctx})`;
          case "getDate":
            return `EXTRACT(DAY FROM ${ctx})`;
          case "getDay":
            return `EXTRACT(DOW FROM ${ctx})`;
          case "getHours":
            return `EXTRACT(HOUR FROM ${ctx})`;
          case "getMinutes":
            return `EXTRACT(MINUTE FROM ${ctx})`;
          case "getSeconds":
            return `EXTRACT(SECOND FROM ${ctx})`;
          default:
            throw new Error(`@lambdaql/mikro-orm: méthode non supportée : ${m.method}`);
        }
      }

      case "ConditionalExpression": {
        const c = node as ConditionalExpression;
        return `CASE WHEN ${this.expr(c.condition, aliases)} THEN ${this.expr(c.consequent, aliases)} ELSE ${this.expr(c.alternate, aliases)} END`;
      }

      case "NullishExpression": {
        const n = node as NullishExpression;
        return `COALESCE(${this.expr(n.left, aliases)}, ${this.expr(n.right, aliases)})`;
      }

      case "LambdaExpression":
        return this.lambda(node as LambdaExpression).condition;

      default:
        throw new Error(`@lambdaql/mikro-orm: type d'expression non supporté : ${(node as any).kind}`);
    }
  }

  // Remonte la chaîne de PropertyExpressions et retourne l'alias du dernier segment de join.
  // u.books → 'books' ; u.company.country → 'country' (ou son override) ; null si hors navigation.
  private extractNavChain(node: Expression, aliases: Map<string, string>): string | null {
    if (node.kind !== "PropertyExpression") return null;
    const segments: string[] = [];
    let cur: Expression = node;
    while (cur.kind === "PropertyExpression") {
      segments.unshift((cur as PropertyExpression).property);
      cur = (cur as PropertyExpression).context;
    }
    if (cur.kind !== "NameExpression" || !aliases.has((cur as NameExpression).name)) return null;
    if (segments.length === 0) return null;
    return this.aliasOverrides[segments[segments.length - 1]] ?? segments[segments.length - 1];
  }

  private likeVal(arg: Expression | undefined): string {
    if (!arg || arg.kind !== "ConstantExpression") throw new Error("L'argument LIKE doit être une constante string");
    return String((arg as ConstantExpression).value)
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");
  }
}
