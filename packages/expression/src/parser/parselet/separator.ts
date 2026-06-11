import type { InfixParselet } from './index.js'
import type { Parser } from '../index.js'
import type { Expression } from '../expression/index.js'
import type { Token } from '../../token/index.js'
import { TokenType } from '../../token/type.js'

export class SeparatorParselet implements InfixParselet {
  readonly type = 'infix' as const
  readonly key  = TokenType.COMMA
  getPrecedence(): number { return 40 }
  parse(parser: Parser, left: Expression, _token: Token): Expression {
    const right = parser.expression(this.getPrecedence())
    const l = Array.isArray(left)  ? left  : [left]
    const r = Array.isArray(right) ? right : [right]
    return [...l, ...r].flat(Infinity) as unknown as Expression
  }
}
