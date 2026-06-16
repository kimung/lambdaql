import { Expression } from "./index.js";
export type ConstantValue = string | number | boolean | null | undefined;
export class ConstantExpression extends Expression {
  readonly kind = "ConstantExpression" as const;
  constructor(public readonly value: ConstantValue) {
    super();
  }
}
