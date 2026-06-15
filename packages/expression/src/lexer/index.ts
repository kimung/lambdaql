import * as acorn from 'acorn'
import { Token } from '../token/index.js'
import { TokenKind } from '../token/kind.js'
import { TokenType } from '../token/type.js'

interface RawToken {
  type: { label: string }
  value: unknown
  loc?: { start: { line: number; column: number } }
}

export class Lexer {
  private readonly raw: RawToken[]

  constructor(source: string) {
    this.raw = []
    const iter = (acorn as any).tokenizer(source, { ecmaVersion: 2022, locations: true })
    let t: any
    while ((t = iter.getToken()).type.label !== 'eof') {
      this.raw.push(t as RawToken)
    }
  }

  private transform(token: RawToken): Token {
    const label = token.type.label
    const value = token.value as string | number | boolean | null | undefined
    const line  = token.loc?.start.line
    const col   = token.loc?.start.column

    switch (label) {
      case 'name':
        return new Token(TokenKind.Identifier, value, TokenType.IDENTIFIER, line, col)
      case 'num': {
        const n = Number(value)
        if (String(value).includes('.') || String(value).toLowerCase().includes('e'))
          return new Token(TokenKind.Float, n, TokenType.FLOAT, line, col)
        return new Token(TokenKind.Integer, n, TokenType.INTEGER, line, col)
      }
      case 'string':
        return new Token(TokenKind.String, value, TokenType.STRING, line, col)
      case 'template':
        return new Token(TokenKind.String, value, TokenType.TEMPLATE, line, col)
      case 'true':
        return new Token(TokenKind.Boolean, true, TokenType.BOOLEAN, line, col)
      case 'false':
        return new Token(TokenKind.Boolean, false, TokenType.BOOLEAN, line, col)
      case 'null':
        return new Token(TokenKind.Null, null, TokenType.NULL, line, col)
      case 'keyword':
        return new Token(TokenKind.Identifier, value, TokenType.IDENTIFIER, line, col)
      case '=>':
        return new Token(TokenKind.Operator, '=>', TokenType.ARROW, line, col)
      case '(':
      case ')':
      case '{':
      case '}':
      case '[':
      case ']':
      case ':':
      case ';':
        return new Token(TokenKind.Delimiter, label, label, line, col)
      case ',':
        return new Token(TokenKind.Separator, ',', TokenType.COMMA, line, col)
      // acorn groups operators by label (e.g. "</>/<=/>=", "==/!=/===/!==", "+/-", "!/~")
      // use token.value as the canonical key
      default: {
        const op = (value as string | undefined) ?? label
        return new Token(TokenKind.Operator, op, op, line, col)
      }
    }
  }

  *tokenize(): Generator<Token> {
    for (const raw of this.raw) yield this.transform(raw)
  }
}
