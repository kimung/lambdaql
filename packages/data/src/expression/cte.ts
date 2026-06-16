import type { SelectExpression } from "./select.js";
import type { UnionExpression } from "./union.js";

export class CteExpression {
  readonly kind = "CteExpression" as const;
  constructor(
    public readonly name: string,
    public readonly query: SelectExpression | UnionExpression,
    public readonly recursive: boolean = false,
  ) {}
}
