import type { FieldExpression } from "@lambdaql/expression";
import type { SourceExpression } from "./source.js";

export class InsertExpression {
  readonly kind = "InsertExpression" as const;
  constructor(
    public readonly source: SourceExpression,
    public readonly fields: readonly FieldExpression[],
  ) {}
}
