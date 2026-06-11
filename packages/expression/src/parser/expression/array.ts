import { Expression } from './index.js'

export class ArrayLiteralExpression extends Expression {
  readonly kind = 'ArrayLiteralExpression' as const
  constructor(public readonly elements: readonly Expression[]) { super() }
}
