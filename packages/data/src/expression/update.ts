import type { FieldExpression, LambdaExpression } from "@gamn9/expression";
import type { SourceExpression } from "./source.js";

export class UpdateExpression {
  readonly kind = "UpdateExpression" as const;
  constructor(
    public readonly source: SourceExpression,
    public readonly fields: readonly FieldExpression[],
    public readonly where: LambdaExpression | undefined = undefined,
  ) {}
}
