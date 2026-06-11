import { Expression } from './index.js'
export class ConditionalExpression extends Expression {
  readonly kind = 'ConditionalExpression' as const
  constructor(public readonly condition: Expression, public readonly consequent: Expression, public readonly alternate: Expression) { super() }
}
