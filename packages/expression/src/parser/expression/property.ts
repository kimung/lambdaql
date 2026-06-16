import { Expression } from "./index.js";
export class PropertyExpression extends Expression {
  readonly kind = "PropertyExpression" as const;
  constructor(
    public readonly context: Expression,
    public readonly property: string,
  ) {
    super();
  }
}
