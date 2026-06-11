import { Expression } from './index.js'
export class NameExpression extends Expression {
  readonly kind = 'NameExpression' as const
  constructor(public readonly name: string) { super() }
}
