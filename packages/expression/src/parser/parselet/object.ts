import type { PrefixParselet } from './index.js'
import type { Parser } from '../index.js'
import type { Token } from '../../token/index.js'
import { ObjectLiteralExpression } from '../expression/object.js'
import { FieldExpression } from '../expression/field.js'
import { TokenType } from '../../token/type.js'

export class ObjectLiteralParselet implements PrefixParselet {
  readonly type = 'prefix' as const
  readonly key  = TokenType.LEFT_BRACE
  parse(parser: Parser, _token: Token): ObjectLiteralExpression {
    const fields: FieldExpression[] = []
    while (parser.peek(1)?.key !== TokenType.RIGHT_BRACE) {
      const nameTok = parser.advance()
      parser.consume(TokenType.COLON)
      const value = parser.expression(41) // >separator(40), stops at ','
      fields.push(new FieldExpression(nameTok.value as string, value))
      if (parser.peek(1)?.key === TokenType.COMMA) parser.advance()
    }
    parser.consume(TokenType.RIGHT_BRACE)
    return new ObjectLiteralExpression(fields)
  }
}
