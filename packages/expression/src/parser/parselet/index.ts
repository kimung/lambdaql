import type { Parser } from "../index.js";
import type { Expression } from "../expression/index.js";
import type { Token } from "../../token/index.js";

export interface PrefixParselet {
  readonly type: "prefix";
  readonly key: string;
  parse(parser: Parser, token: Token): Expression;
}

export interface InfixParselet {
  readonly type: "infix";
  readonly key: string;
  getPrecedence(): number;
  parse(parser: Parser, left: Expression, token: Token): Expression;
}
