import { Expression } from "./index.js";
export class UnaryExpression extends Expression {
  readonly kind = "UnaryExpression" as const;
  constructor(
    public readonly operator: string,
    public readonly operand: Expression,
  ) {
    super();
  }
}
