import { Parser } from "./index.js";
import { LambdaParselet } from "./parselet/lambda.js";
import { SeparatorParselet } from "./parselet/separator.js";
import type { LambdaExpression } from "./expression/lambda.js";
import type { Lexer } from "../lexer/index.js";

export class LambdaParser extends Parser {
  constructor(lexer: Lexer) {
    super(lexer);
    this.grammar.parselets.addInfix(new SeparatorParselet());
    this.grammar.parselets.addInfix(new LambdaParselet());
  }
  override parse(): LambdaExpression {
    return super.parse() as LambdaExpression;
  }
}
