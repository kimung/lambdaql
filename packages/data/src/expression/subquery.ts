import type { LambdaExpression } from "@lambdaql/expression";
import type { SelectExpression } from "./select.js";
import type { UnionExpression } from "./union.js";

export type SubqueryOp = "IN" | "NOT IN" | "EXISTS" | "NOT EXISTS";

export class SubqueryCondition {
  readonly kind = "SubqueryCondition" as const;
  constructor(
    public readonly op: SubqueryOp,
    public readonly field: LambdaExpression | undefined, // undefined pour EXISTS / NOT EXISTS
    public readonly inner: SelectExpression | UnionExpression,
  ) {}
}
