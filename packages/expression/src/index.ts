import { Lexer } from "./lexer/index.js";
import { LambdaParser } from "./parser/lambda.js";
import type { LambdaExpression } from "./parser/expression/lambda.js";

export type { Expression } from "./parser/expression/index.js";
export { NameExpression } from "./parser/expression/name.js";
export { ConstantExpression } from "./parser/expression/constant.js";
export { BinaryExpression } from "./parser/expression/binary.js";
export { UnaryExpression } from "./parser/expression/unary.js";
export { PropertyExpression } from "./parser/expression/property.js";
export { MethodExpression } from "./parser/expression/method.js";
export { FieldExpression } from "./parser/expression/field.js";
export { ObjectLiteralExpression } from "./parser/expression/object.js";
export { LambdaExpression } from "./parser/expression/lambda.js";
export { ConditionalExpression } from "./parser/expression/conditional.js";
export { NullishExpression } from "./parser/expression/nullish.js";
export { ArrayLiteralExpression } from "./parser/expression/array.js";
export { TemplateLiteralExpression } from "./parser/expression/template.js";
export { visit } from "./utils/visitor.js";
export type { ExpressionVisitor } from "./utils/visitor.js";
export { toSql } from "./utils/sql-visitor.js";

export const expression = {
  lambda: {
    parse<TArgs extends unknown[] = unknown[]>(fn: (...args: TArgs) => unknown): LambdaExpression {
      const lexer = new Lexer(fn.toString());
      const parser = new LambdaParser(lexer);
      return parser.parse();
    },
  },
};
