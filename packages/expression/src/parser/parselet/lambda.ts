import type { InfixParselet } from "./index.js";
import type { Parser } from "../index.js";
import type { Expression } from "../expression/index.js";
import type { Token } from "../../token/index.js";
import { LambdaExpression } from "../expression/lambda.js";
import type { NameExpression } from "../expression/name.js";
import { TokenType } from "../../token/type.js";

// La destructuration des paramètres (`({ age }) => …`) n'est pas supportée par le parser
// runtime : elle exige une réécriture du corps que seul le transformer AOT effectue. Même
// limitation que les closures (cf. SqlTranslator) — on oriente vers l'AOT plutôt que de
// laisser échouer sur une erreur cryptique. `ObjectLiteralParselet` réutilise ce message
// pour le shorthand `{ age }`, qui échoue en amont (avant d'atteindre ce parselet).
export const DESTRUCTURING_NOT_SUPPORTED =
  "Object destructuring in lambda parameters requires the @lambdaql/compiler AOT transformer. " +
  "Without it, only plain (non-destructured) parameters are supported at runtime.";

export class LambdaParselet implements InfixParselet {
  readonly type = "infix" as const;
  readonly key = TokenType.ARROW;
  getPrecedence(): number {
    return 150;
  }
  parse(parser: Parser, left: Expression, _token: Token): LambdaExpression {
    const args = (Array.isArray(left) ? left : [left]) as Expression[];
    for (const arg of args) {
      if (arg.kind === "ObjectLiteralExpression") throw new Error(DESTRUCTURING_NOT_SUPPORTED);
      if (arg.kind !== "NameExpression") {
        throw new Error(`Lambda parameter must be a NameExpression, got ${arg.kind}`);
      }
    }
    return new LambdaExpression(parser.expression(0), args as NameExpression[]);
  }
}
