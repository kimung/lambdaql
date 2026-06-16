import { Expression } from "./index.js";

export class TemplateLiteralExpression extends Expression {
  readonly kind = "TemplateLiteralExpression" as const;
  constructor(
    public readonly quasis: readonly string[],
    public readonly expressions: readonly Expression[],
  ) {
    super();
  }
}
