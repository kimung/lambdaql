import type { InfixParselet } from './index.js'
import type { Parser } from '../index.js'
import type { Expression } from '../expression/index.js'
import type { Token } from '../../token/index.js'
import { FieldExpression } from '../expression/field.js'
import { TokenType } from '../../token/type.js'

export class FieldParselet implements InfixParselet {
  readonly type = 'infix' as const
  readonly key  = TokenType.COLON
  getPrecedence(): number { return 10 }
  parse(parser: Parser, left: Expression, _token: Token): FieldExpression {
    return new FieldExpression((left as any).name as string, parser.expression(this.getPrecedence()))
  }
}
