import type { Token } from '../token/index.js'
import type { Expression } from './expression/index.js'
import { Grammar } from './grammar.js'
import type { Lexer } from '../lexer/index.js'

export class Parser {
  private readonly tokenGen: Generator<Token>
  protected readonly grammar: Grammar
  private readonly buffer: Token[] = []

  constructor(lexer: Lexer) {
    this.tokenGen = lexer.tokenize()
    this.grammar  = new Grammar()
  }

  private fillBuffer(count: number): void {
    while (this.buffer.length < count) {
      const result = this.tokenGen.next()
      if (result.done) break
      this.buffer.push(result.value)
    }
  }

  advance(): Token {
    this.fillBuffer(1)
    const token = this.buffer.shift()
    if (!token) throw new Error('Unexpected end of input')
    return token
  }

  peek(jump = 1): Token | undefined {
    this.fillBuffer(jump)
    return this.buffer[jump - 1]
  }

  consume(expectedKey: string): Token {
    const token = this.advance()
    if (token.key !== expectedKey)
      throw new Error(`Expected "${expectedKey}" but got "${token.key}"${token.loc()}`)
    return token
  }

  private getPrecedence(): number {
    const next = this.peek(1)
    if (!next) return 0
    return this.grammar.parselets.infix.get(next.key)?.getPrecedence() ?? 0
  }

  expression(precedence = 0): Expression {
    const token  = this.advance()
    const prefix = this.grammar.parselets.prefix.get(token.key)
    if (!prefix)
      throw new Error(`Unexpected token "${token.key}"${token.loc()}`)
    let left: Expression = prefix.parse(this, token)
    while (precedence < this.getPrecedence()) {
      const next  = this.advance()
      const infix = this.grammar.parselets.infix.get(next.key)!
      left = infix.parse(this, left, next)
    }
    return left
  }

  parse(): Expression {
    return this.expression()
  }
}
