import * as ts from "typescript";
import { GLOBAL_NAMES } from "./constants.js";

export function generateLambda(fn: ts.ArrowFunction, sf: ts.SourceFile): string {
  const params = collectParams(fn);
  const argsStr = fn.parameters
    .map((p) => `{kind:"NameExpression",name:${JSON.stringify((p.name as ts.Identifier).text)}}`)
    .join(",");
  const bodyStr = generateExpr(fn.body as ts.Expression, params, sf);
  return `{kind:"LambdaExpression",args:[${argsStr}],body:${bodyStr}}`;
}

function collectParams(fn: ts.ArrowFunction): Set<string> {
  const names = new Set<string>();
  for (const p of fn.parameters) {
    if (ts.isIdentifier(p.name)) names.add(p.name.text);
  }
  return names;
}

function generateExpr(node: ts.Expression, params: Set<string>, sf: ts.SourceFile): string {
  if (ts.isIdentifier(node)) {
    if (params.has(node.text) || GLOBAL_NAMES.has(node.text))
      return `{kind:"NameExpression",name:${JSON.stringify(node.text)}}`;
    // Closure : référence externe — garder la ref vivante, l'identifiant est émis tel quel
    return `{kind:"ConstantExpression",value:${node.text}}`;
  }

  if (ts.isNumericLiteral(node)) return `{kind:"ConstantExpression",value:${node.text}}`;
  if (ts.isStringLiteral(node)) return `{kind:"ConstantExpression",value:${JSON.stringify(node.text)}}`;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return `{kind:"ConstantExpression",value:true}`;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return `{kind:"ConstantExpression",value:false}`;
  if (node.kind === ts.SyntaxKind.NullKeyword) return `{kind:"ConstantExpression",value:null}`;

  if (node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
    const text = JSON.stringify((node as ts.NoSubstitutionTemplateLiteral).text);
    return `{kind:"TemplateLiteralExpression",quasis:[${text}],expressions:[]}`;
  }

  if (ts.isTemplateExpression(node)) {
    const quasis = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)]
      .map((q) => JSON.stringify(q))
      .join(",");
    const exprs = node.templateSpans.map((s) => generateExpr(s.expression as ts.Expression, params, sf)).join(",");
    return `{kind:"TemplateLiteralExpression",quasis:[${quasis}],expressions:[${exprs}]}`;
  }

  if (ts.isBinaryExpression(node)) {
    const op = JSON.stringify(node.operatorToken.getText(sf));
    const left = generateExpr(node.left, params, sf);
    const right = generateExpr(node.right, params, sf);
    return `{kind:"BinaryExpression",operator:${op},left:${left},right:${right}}`;
  }

  if (ts.isPrefixUnaryExpression(node)) {
    const op =
      node.operator === ts.SyntaxKind.ExclamationToken ? "!" : node.operator === ts.SyntaxKind.MinusToken ? "-" : "~";
    const operand = generateExpr(node.operand, params, sf);
    return `{kind:"UnaryExpression",operator:${JSON.stringify(op)},operand:${operand}}`;
  }

  if (ts.isConditionalExpression(node)) {
    const cond = generateExpr(node.condition, params, sf);
    const consequent = generateExpr(node.whenTrue, params, sf);
    const alternate = generateExpr(node.whenFalse, params, sf);
    return `{kind:"ConditionalExpression",condition:${cond},consequent:${consequent},alternate:${alternate}}`;
  }

  if (ts.isArrayLiteralExpression(node)) {
    const elements = node.elements.map((e) => generateExpr(e as ts.Expression, params, sf)).join(",");
    return `{kind:"ArrayLiteralExpression",elements:[${elements}]}`;
  }

  if (ts.isObjectLiteralExpression(node)) {
    const fields = node.properties
      .filter(ts.isPropertyAssignment)
      .map((p) => {
        const name = JSON.stringify((p.name as ts.Identifier).text);
        const assignment = generateExpr(p.initializer as ts.Expression, params, sf);
        return `{kind:"FieldExpression",name:${name},assignment:${assignment}}`;
      })
      .join(",");
    return `{kind:"ObjectLiteralExpression",fields:[${fields}]}`;
  }

  if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) return generateAccess(node, params, sf);

  if (ts.isParenthesizedExpression(node)) return generateExpr(node.expression, params, sf);
  if (ts.isAsExpression(node)) return generateExpr(node.expression, params, sf);
  if (ts.isNonNullExpression(node)) return generateExpr(node.expression, params, sf);

  throw new Error(`@lambdaql/unplugin: unsupported expression kind ${ts.SyntaxKind[node.kind]}`);
}

function generateAccess(
  node: ts.PropertyAccessExpression | ts.CallExpression,
  params: Set<string>,
  sf: ts.SourceFile,
): string {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const ctx = generateExpr(node.expression.expression as ts.Expression, params, sf);
    const method = JSON.stringify(node.expression.name.text);
    const args = node.arguments.map((a) => generateExpr(a as ts.Expression, params, sf)).join(",");
    return `{kind:"MethodExpression",context:${ctx},method:${method},args:[${args}]}`;
  }
  if (ts.isPropertyAccessExpression(node)) {
    const ctx = generateExpr(node.expression, params, sf);
    const property = JSON.stringify(node.name.text);
    return `{kind:"PropertyExpression",context:${ctx},property:${property}}`;
  }
  throw new Error("@lambdaql/unplugin: unexpected access node");
}
