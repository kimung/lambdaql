import type { InfixParselet } from './index.js'
import type { Parser } from '../index.js'
import type { Expression } from '../expression/index.js'
import type { Token } from '../../token/index.js'
import { BinaryExpression } from '../expression/binary.js'

export class BinaryParselet implements InfixParselet {
  readonly type = 'infix' as const
  constructor(
    public readonly key: string,
    private readonly precedence: number,
    private readonly rightAssociative = false,
  ) {}
  getPrecedence(): number { return this.precedence }
  parse(parser: Parser, left: Expression, token: Token): BinaryExpression {
    const prec = this.rightAssociative ? this.precedence - 1 : this.precedence
    return new BinaryExpression(left, parser.expression(prec), token.value as string)
  }
}
