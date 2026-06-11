import type { PrefixParselet } from './index.js'
import type { Parser }          from '../index.js'
import type { Expression }      from '../expression/index.js'
import type { Token }           from '../../token/index.js'
import { ArrayLiteralExpression } from '../expression/array.js'
import { TokenType }            from '../../token/type.js'

export class ArrayParselet implements PrefixParselet {
  readonly type = 'prefix' as const
  readonly key  = TokenType.LEFT_BRACKET
  parse(parser: Parser, _token: Token): Expression {
    const elements: Expression[] = []
    while (parser.peek(1)?.key !== TokenType.RIGHT_BRACKET) {
      elements.push(parser.expression(40))
      if (parser.peek(1)?.key === TokenType.COMMA) parser.advance()
    }
    parser.advance() // consume ']'
    return new ArrayLiteralExpression(elements)
  }
}
