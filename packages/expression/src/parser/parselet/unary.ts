import type { PrefixParselet } from './index.js'
import type { Parser } from '../index.js'
import type { Token } from '../../token/index.js'
import { UnaryExpression } from '../expression/unary.js'

export class UnaryParselet implements PrefixParselet {
  readonly type = 'prefix' as const
  constructor(public readonly key: string) {}
  parse(parser: Parser, token: Token): UnaryExpression {
    return new UnaryExpression(token.value as string, parser.expression(80))
  }
}
