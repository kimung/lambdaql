import { Lexer } from "./packages/expression/dist/lexer/index.js";
import { LambdaParser } from "./packages/expression/dist/parser/lambda.js";

function parse(src) {
  return new LambdaParser(new Lexer(src)).parse();
}

function printTree(expr, indent = 0) {
  const prefix = "  ".repeat(indent);
  if (expr.kind === "BinaryExpression") {
    console.log(`${prefix}BinaryExpression (${expr.operator})`);
    console.log(`${prefix}  left:`);
    printTree(expr.left, indent + 2);
    console.log(`${prefix}  right:`);
    printTree(expr.right, indent + 2);
  } else if (expr.kind === "PropertyExpression") {
    console.log(`${prefix}PropertyExpression (${expr.property})`);
  } else if (expr.kind === "ConstantExpression") {
    console.log(`${prefix}ConstantExpression (${expr.value})`);
  } else if (expr.kind === "NameExpression") {
    console.log(`${prefix}NameExpression (${expr.name})`);
  } else if (expr.kind === "LambdaExpression") {
    console.log(`${prefix}LambdaExpression`);
    console.log(`${prefix}  body:`);
    printTree(expr.body, indent + 2);
  } else {
    console.log(`${prefix}${expr.kind}`);
  }
}

console.log("=== Test: x < a + b (should be x < (a + b)) ===");
const ast1 = parse("x => x < a + b");
printTree(ast1);

console.log("\n=== Test: x + a < b (should be (x + a) < b) ===");
const ast2 = parse("x => x + a < b");
printTree(ast2);

console.log("\n=== Test: x * y < z (should be (x * y) < z) ===");
const ast3 = parse("x => x * y < z");
printTree(ast3);

console.log("\n=== Test: x < y * z (should be x < (y * z)) ===");
const ast4 = parse("x => x < y * z");
printTree(ast4);
