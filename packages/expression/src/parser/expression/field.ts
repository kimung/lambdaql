import { Expression } from "./index.js";
export class FieldExpression extends Expression {
  readonly kind = "FieldExpression" as const;
  constructor(
    public readonly name: string,
    public readonly assignment: Expression,
  ) {
    super();
  }
}
