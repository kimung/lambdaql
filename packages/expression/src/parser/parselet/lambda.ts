import type { InfixParselet } from "./index.js";
import type { Parser } from "../index.js";
import type { Expression } from "../expression/index.js";
import type { Token } from "../../token/index.js";
import { LambdaExpression } from "../expression/lambda.js";
import type { NameExpression } from "../expression/name.js";
import { TokenType } from "../../token/type.js";

export class LambdaParselet implements InfixParselet {
  readonly type = "infix" as const;
  readonly key = TokenType.ARROW;
  getPrecedence(): number {
    return 150;
  }
  parse(parser: Parser, left: Expression, _token: Token): LambdaExpression {
    const args = (Array.isArray(left) ? left : [left]) as NameExpression[];
    return new LambdaExpression(parser.expression(0), args);
  }
}
