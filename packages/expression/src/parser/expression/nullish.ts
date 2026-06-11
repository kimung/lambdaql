import { Expression } from './index.js'
export class NullishExpression extends Expression {
  readonly kind = 'NullishExpression' as const
  constructor(public readonly left: Expression, public readonly right: Expression) { super() }
}
