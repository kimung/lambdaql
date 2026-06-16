import { Expression } from "./index.js";
export class MethodExpression extends Expression {
  readonly kind = "MethodExpression" as const;
  constructor(
    public readonly context: Expression,
    public readonly method: string,
    public readonly args: Expression[],
  ) {
    super();
  }
}
