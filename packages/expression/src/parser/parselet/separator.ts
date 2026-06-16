import type { InfixParselet } from "./index.js";
import type { Parser } from "../index.js";
import type { Expression } from "../expression/index.js";
import type { Token } from "../../token/index.js";
import { TokenType } from "../../token/type.js";

// Précédence de la virgule : sous tous les opérateurs infixes (le plus bas étant le
// ternaire à 20). Les parselets d'éléments (objet/tableau/appel) parsent leurs valeurs
// avec ce seuil pour englober tout opérateur et ne s'arrêter qu'à la virgule.
export const SEPARATOR_PRECEDENCE = 5;

export class SeparatorParselet implements InfixParselet {
  readonly type = "infix" as const;
  readonly key = TokenType.COMMA;
  // La virgule doit être le plus bas niveau de précédence (sous le ternaire à 20),
  // sinon un opérateur de faible précédence dans une valeur — { x: a ?? b }, [a || b],
  // f(a ? b : c) — serait tronqué avant la virgule. Cf. SEPARATOR_PRECEDENCE.
  getPrecedence(): number {
    return SEPARATOR_PRECEDENCE;
  }
  parse(parser: Parser, left: Expression, _token: Token): Expression {
    const right = parser.expression(this.getPrecedence());
    const l = Array.isArray(left) ? left : [left];
    const r = Array.isArray(right) ? right : [right];
    return [...l, ...r].flat(Infinity) as unknown as Expression;
  }
}
