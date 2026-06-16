import type { PrefixParselet } from "./index.js";
import type { Parser } from "../index.js";
import { NameExpression } from "../expression/name.js";
import type { Token } from "../../token/index.js";
import { TokenType } from "../../token/type.js";

export class NameParselet implements PrefixParselet {
  readonly type = "prefix" as const;
  readonly key = TokenType.IDENTIFIER;
  parse(_parser: Parser, token: Token): NameExpression {
    return new NameExpression(token.value as string);
  }
}
