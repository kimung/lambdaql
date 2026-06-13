import { ParseletCollection }      from './parselet/collection.js'
import { NameParselet }            from './parselet/name.js'
import { createConstantParselets } from './parselet/constant.js'
import { GroupParselet }           from './parselet/group.js'
import { UnaryParselet }           from './parselet/unary.js'
import { BinaryParselet }          from './parselet/binary.js'
import { CallParselet }            from './parselet/call.js'
import { ArrayParselet }           from './parselet/array.js'
import { ObjectLiteralParselet }   from './parselet/object.js'
import { ConditionalParselet }     from './parselet/conditional.js'
import { TokenType }               from '../token/type.js'

export class Grammar {
  readonly parselets = new ParseletCollection()
  constructor() {
    this.parselets.addPrefix(new NameParselet())
    for (const p of createConstantParselets()) this.parselets.addPrefix(p)
    this.parselets.addPrefix(new GroupParselet())
    this.parselets.addPrefix(new ArrayParselet())
    this.parselets.addPrefix(new ObjectLiteralParselet())
    this.parselets.addPrefix(new UnaryParselet(TokenType.BANG))
    this.parselets.addPrefix(new UnaryParselet(TokenType.MINUS))

    this.parselets.addInfix(new CallParselet())
    this.parselets.addInfix(new CallParselet(TokenType.OPTIONAL_CHAIN))
    this.parselets.addInfix(new ConditionalParselet())

    this.parselets.addInfix(new BinaryParselet(TokenType.NULLISH,  25, true))
    this.parselets.addInfix(new BinaryParselet(TokenType.OR,       30, true))
    this.parselets.addInfix(new BinaryParselet(TokenType.AND,      35, true))

    this.parselets.addInfix(new BinaryParselet(TokenType.EQEQEQ,  45))
    this.parselets.addInfix(new BinaryParselet(TokenType.EQEQ,    45))
    this.parselets.addInfix(new BinaryParselet(TokenType.NOTEQEQ, 45))
    this.parselets.addInfix(new BinaryParselet(TokenType.NOTEQ,   45))
    this.parselets.addInfix(new BinaryParselet(TokenType.LTE,     50))
    this.parselets.addInfix(new BinaryParselet(TokenType.GTE,     50))
    this.parselets.addInfix(new BinaryParselet(TokenType.LT,      50))
    this.parselets.addInfix(new BinaryParselet(TokenType.GT,      50))

    this.parselets.addInfix(new BinaryParselet(TokenType.PLUS,     60))
    this.parselets.addInfix(new BinaryParselet(TokenType.MINUS,    60))
    this.parselets.addInfix(new BinaryParselet(TokenType.ASTERISK, 70))
    this.parselets.addInfix(new BinaryParselet(TokenType.SLASH,    70))
    this.parselets.addInfix(new BinaryParselet(TokenType.PERCENT,  70))
  }
}
