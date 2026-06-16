import { Expression } from "./index.js";
import type { FieldExpression } from "./field.js";
export class ObjectLiteralExpression extends Expression {
  readonly kind = "ObjectLiteralExpression" as const;
  constructor(public readonly fields: FieldExpression[]) {
    super();
  }
}
