import type { PrefixParselet } from "./index.js";
import type { Parser } from "../index.js";
import type { Token } from "../../token/index.js";
import { ObjectLiteralExpression } from "../expression/object.js";
import { FieldExpression } from "../expression/field.js";
import { TokenType } from "../../token/type.js";
import { SEPARATOR_PRECEDENCE } from "./separator.js";
import { DESTRUCTURING_NOT_SUPPORTED } from "./lambda.js";

export class ObjectLiteralParselet implements PrefixParselet {
  readonly type = "prefix" as const;
  readonly key = TokenType.LEFT_BRACE;
  parse(parser: Parser, _token: Token): ObjectLiteralExpression {
    const fields: FieldExpression[] = [];
    while (parser.peek(1)?.key !== TokenType.RIGHT_BRACE) {
      const nameTok = parser.advance();
      // Shorthand `{ age }` (pas de `:`) : c'est un motif de destructuration de paramètre,
      // qui requiert l'AOT. Sans cette garde, le consume(COLON) lèverait « Expected COLON ».
      if (parser.peek(1)?.key !== TokenType.COLON) throw new Error(DESTRUCTURING_NOT_SUPPORTED);
      parser.consume(TokenType.COLON);
      const value = parser.expression(SEPARATOR_PRECEDENCE); // englobe tout opérateur, stoppe à ','
      fields.push(new FieldExpression(nameTok.value as string, value));
      if (parser.peek(1)?.key === TokenType.COMMA) parser.advance();
    }
    parser.consume(TokenType.RIGHT_BRACE);
    return new ObjectLiteralExpression(fields);
  }
}
