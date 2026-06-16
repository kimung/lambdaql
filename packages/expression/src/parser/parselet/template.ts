import type { PrefixParselet } from "./index.js";
import type { Parser } from "../index.js";
import type { Expression } from "../expression/index.js";
import type { Token } from "../../token/index.js";
import { TemplateLiteralExpression } from "../expression/template.js";

export class TemplateParselet implements PrefixParselet {
  readonly type = "prefix" as const;
  readonly key = "`";

  parse(parser: Parser, _token: Token): Expression {
    const quasis: string[] = [];
    const expressions: Expression[] = [];

    quasis.push((parser.advance().value ?? "") as string);

    while (true) {
      const next = parser.peek(1);
      if (!next || next.key === "`") {
        parser.advance();
        break;
      }
      parser.consume("${");
      expressions.push(parser.expression(0));
      parser.consume("}");
      quasis.push((parser.advance().value ?? "") as string);
    }

    return new TemplateLiteralExpression(quasis, expressions);
  }
}
