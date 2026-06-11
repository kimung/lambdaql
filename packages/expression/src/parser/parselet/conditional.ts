import type { InfixParselet } from './index.js'
import type { Parser } from '../index.js'
import type { Expression } from '../expression/index.js'
import type { Token } from '../../token/index.js'
import { ConditionalExpression } from '../expression/conditional.js'
import { TokenType } from '../../token/type.js'

export class ConditionalParselet implements InfixParselet {
  readonly type = 'infix' as const
  readonly key  = TokenType.QUESTION
  getPrecedence(): number { return 20 }
  parse(parser: Parser, condition: Expression, _token: Token): ConditionalExpression {
    const consequent = parser.expression(0)
    parser.consume(TokenType.COLON)
    const alternate  = parser.expression(this.getPrecedence() - 1)
    return new ConditionalExpression(condition, consequent, alternate)
  }
}
