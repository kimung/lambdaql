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
    for (const arg of args) {
      if (arg.kind !== "NameExpression") {
        throw new Error(`Lambda parameter must be a NameExpression, got ${arg.kind}`);
      }
    }
    return new LambdaExpression(parser.expression(0), args);
  }
}
