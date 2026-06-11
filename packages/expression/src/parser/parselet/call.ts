import type { InfixParselet } from './index.js'
import type { Parser } from '../index.js'
import type { Expression } from '../expression/index.js'
import type { Token } from '../../token/index.js'
import { PropertyExpression } from '../expression/property.js'
import { MethodExpression } from '../expression/method.js'
import { TokenType } from '../../token/type.js'
import { SEPARATOR_PRECEDENCE } from './separator.js'

export class CallParselet implements InfixParselet {
  readonly type = 'infix' as const
  readonly key: string
  constructor(key: string = TokenType.POINT) { this.key = key }
  getPrecedence(): number { return 100 }
  parse(parser: Parser, left: Expression, _token: Token): Expression {
    const nameTok = parser.advance()
    const peek    = parser.peek(1)
    if (!peek || peek.key !== TokenType.LEFT_PAREN)
      return new PropertyExpression(left, nameTok.value as string)
    parser.advance() // consume '('
    const args: Expression[] = []
    // Seuil = précédence de la virgule : chaque argument englobe tout opérateur mais
    // s'arrête à la virgule, que la boucle consomme ensuite individuellement.
    while (parser.peek(1)?.key !== TokenType.RIGHT_PAREN) {
      args.push(parser.expression(SEPARATOR_PRECEDENCE))
      if (parser.peek(1)?.key === TokenType.COMMA) parser.advance()
    }
    parser.advance() // consume ')'
    return new MethodExpression(left, nameTok.value as string, args)
  }
}
