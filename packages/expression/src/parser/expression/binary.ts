import { Expression } from "./index.js";
export class BinaryExpression extends Expression {
  readonly kind = "BinaryExpression" as const;
  constructor(
    public readonly left: Expression,
    public readonly right: Expression,
    public readonly operator: string,
  ) {
    super();
  }
}
