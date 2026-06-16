import type { PrefixParselet } from "./index.js";
import type { Parser } from "../index.js";
import { ConstantExpression } from "../expression/constant.js";
import type { Token } from "../../token/index.js";
import { TokenType } from "../../token/type.js";

export class ConstantParselet implements PrefixParselet {
  readonly type = "prefix" as const;
  constructor(public readonly key: string) {}
  parse(_parser: Parser, token: Token): ConstantExpression {
    return new ConstantExpression(token.value as string | number | boolean | null);
  }
}

export function createConstantParselets(): ConstantParselet[] {
  return [
    new ConstantParselet(TokenType.INTEGER),
    new ConstantParselet(TokenType.FLOAT),
    new ConstantParselet(TokenType.STRING),
    new ConstantParselet(TokenType.BOOLEAN),
    new ConstantParselet(TokenType.NULL),
  ];
}
