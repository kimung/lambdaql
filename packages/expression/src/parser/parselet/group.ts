import type { PrefixParselet } from './index.js'
import type { Parser } from '../index.js'
import type { Expression } from '../expression/index.js'
import type { Token } from '../../token/index.js'
import { TokenType } from '../../token/type.js'

export class GroupParselet implements PrefixParselet {
  readonly type = 'prefix' as const
  readonly key  = TokenType.LEFT_PAREN
  parse(parser: Parser, _token: Token): Expression {
    const expr = parser.expression(0)
    parser.consume(TokenType.RIGHT_PAREN)
    return expr
  }
}
