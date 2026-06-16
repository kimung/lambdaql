import type { LambdaExpression } from "@gamn9/expression";
import type { SourceExpression } from "./source.js";
import type { SubqueryCondition } from "./subquery.js";
import type { RawExpression } from "./raw.js";
import type { CteExpression } from "./cte.js";

export type JoinType = "INNER" | "LEFT";

export class JoinExpression {
  readonly kind = "JoinExpression" as const;
  constructor(
    public readonly source: SourceExpression,
    public readonly predicate: LambdaExpression,
    public readonly type: JoinType,
  ) {}
}

export class OrderExpression {
  readonly kind = "OrderExpression" as const;
  constructor(
    public readonly selector: LambdaExpression,
    public readonly direction: "ASC" | "DESC",
  ) {}
}

export class SelectExpression {
  readonly kind = "SelectExpression" as const;

  constructor(
    public readonly source: SourceExpression,
    public readonly where: readonly LambdaExpression[] = [],
    public readonly joins: readonly JoinExpression[] = [],
    public readonly selector: LambdaExpression | undefined = undefined,
    public readonly groups: readonly LambdaExpression[] = [],
    public readonly having: LambdaExpression | undefined = undefined,
    public readonly orders: readonly OrderExpression[] = [],
    public readonly limitVal: number | undefined = undefined,
    public readonly skipVal: number | undefined = undefined,
    public readonly isDistinct: boolean = false,
    public readonly subqueries: readonly SubqueryCondition[] = [],
    public readonly rawWheres: readonly RawExpression[] = [],
    public readonly rawHaving: RawExpression | undefined = undefined,
    public readonly rawOrders: readonly RawExpression[] = [],
    public readonly ctes: readonly CteExpression[] = [],
  ) {}

  patch(
    opts: Partial<{
      where: readonly LambdaExpression[];
      joins: readonly JoinExpression[];
      selector: LambdaExpression | undefined;
      groups: readonly LambdaExpression[];
      having: LambdaExpression | undefined;
      orders: readonly OrderExpression[];
      limitVal: number | undefined;
      skipVal: number | undefined;
      isDistinct: boolean;
      subqueries: readonly SubqueryCondition[];
      rawWheres: readonly RawExpression[];
      rawHaving: RawExpression | undefined;
      rawOrders: readonly RawExpression[];
      ctes: readonly CteExpression[];
    }>,
  ): SelectExpression {
    return new SelectExpression(
      this.source,
      opts.where ?? this.where,
      opts.joins ?? this.joins,
      "selector" in opts ? opts.selector : this.selector,
      opts.groups ?? this.groups,
      "having" in opts ? opts.having : this.having,
      opts.orders ?? this.orders,
      "limitVal" in opts ? opts.limitVal : this.limitVal,
      "skipVal" in opts ? opts.skipVal : this.skipVal,
      opts.isDistinct ?? this.isDistinct,
      opts.subqueries ?? this.subqueries,
      opts.rawWheres ?? this.rawWheres,
      "rawHaving" in opts ? opts.rawHaving : this.rawHaving,
      opts.rawOrders ?? this.rawOrders,
      opts.ctes ?? this.ctes,
    );
  }
}
