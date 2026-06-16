import type { FieldExpression } from "@gamn9/expression";
import type { SourceExpression } from "./source.js";

export class InsertExpression {
  readonly kind = "InsertExpression" as const;
  constructor(
    public readonly source: SourceExpression,
    public readonly fields: readonly FieldExpression[],
  ) {}
}
