import { Expression } from './index.js'
import type { NameExpression } from './name.js'
export class LambdaExpression extends Expression {
  readonly kind = 'LambdaExpression' as const
  constructor(public readonly body: Expression, public readonly args: NameExpression[]) { super() }
}
