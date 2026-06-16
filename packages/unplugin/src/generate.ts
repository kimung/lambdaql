import * as ts from "typescript";
import { GLOBAL_NAMES } from "./constants.js";

// Un paramètre destructuré (`{ age }`) est désucré en paramètre synthétique positionnel
// (`$p0`) + accès propriété : l'identifiant libre `age` devient `$p0.age`. Tout l'aval
// (translator, aliasMap, joinAliasMap) reste inchangé — il ne voit que des PropertyExpression.
interface Binding {
  param: string; // nom synthétique du paramètre, ex "$p0"
  path: string[]; // chemin de propriétés, ex ["age"] ou ["company", "name"]
}
interface Scope {
  params: Set<string>; // noms émis en NameExpression : params réels + synthétiques
  bindings: Map<string, Binding>; // identifiant local destructuré → binding
}

export function generateLambda(fn: ts.ArrowFunction, sf: ts.SourceFile): string {
  const { argNames, scope } = buildScope(fn);
  const argsStr = argNames.map((n) => `{kind:"NameExpression",name:${JSON.stringify(n)}}`).join(",");
  const bodyStr = generateExpr(fn.body as ts.Expression, scope, sf);
  return `{kind:"LambdaExpression",args:[${argsStr}],body:${bodyStr}}`;
}

function buildScope(fn: ts.ArrowFunction): { argNames: string[]; scope: Scope } {
  const params = new Set<string>();
  const bindings = new Map<string, Binding>();
  const argNames: string[] = [];
  fn.parameters.forEach((p, i) => {
    if (ts.isIdentifier(p.name)) {
      params.add(p.name.text);
      argNames.push(p.name.text);
    } else if (ts.isObjectBindingPattern(p.name)) {
      const synth = `$p${i}`;
      params.add(synth);
      argNames.push(synth);
      collectBindings(p.name, synth, [], bindings);
    } else {
      throw new Error(`@lambdaql/unplugin: unsupported parameter pattern ${ts.SyntaxKind[p.name.kind]}`);
    }
  });
  return { argNames, scope: { params, bindings } };
}

function collectBindings(
  pattern: ts.ObjectBindingPattern,
  param: string,
  prefix: string[],
  out: Map<string, Binding>,
): void {
  for (const el of pattern.elements) {
    if (el.dotDotDotToken) throw new Error("@lambdaql/unplugin: rest element in destructuring is not supported");
    if (el.initializer) throw new Error("@lambdaql/unplugin: default values in destructuring are not supported");
    const sourceKey = el.propertyName ? bindingPropName(el.propertyName) : (el.name as ts.Identifier).text;
    const path = [...prefix, sourceKey];
    if (ts.isObjectBindingPattern(el.name)) {
      collectBindings(el.name, param, path, out);
    } else if (ts.isIdentifier(el.name)) {
      out.set(el.name.text, { param, path });
    } else {
      throw new Error("@lambdaql/unplugin: unsupported binding element");
    }
  }
}

function bindingPropName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  throw new Error("@lambdaql/unplugin: computed property names in destructuring are not supported");
}

function propertyChain(b: Binding): string {
  let expr = `{kind:"NameExpression",name:${JSON.stringify(b.param)}}`;
  for (const key of b.path) {
    expr = `{kind:"PropertyExpression",context:${expr},property:${JSON.stringify(key)}}`;
  }
  return expr;
}

function generateExpr(node: ts.Expression, scope: Scope, sf: ts.SourceFile): string {
  if (ts.isIdentifier(node)) {
    const binding = scope.bindings.get(node.text);
    if (binding) return propertyChain(binding);
    if (scope.params.has(node.text) || GLOBAL_NAMES.has(node.text))
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
    const exprs = node.templateSpans.map((s) => generateExpr(s.expression as ts.Expression, scope, sf)).join(",");
    return `{kind:"TemplateLiteralExpression",quasis:[${quasis}],expressions:[${exprs}]}`;
  }

  if (ts.isBinaryExpression(node)) {
    const op = JSON.stringify(node.operatorToken.getText(sf));
    const left = generateExpr(node.left, scope, sf);
    const right = generateExpr(node.right, scope, sf);
    return `{kind:"BinaryExpression",operator:${op},left:${left},right:${right}}`;
  }

  if (ts.isPrefixUnaryExpression(node)) {
    const op =
      node.operator === ts.SyntaxKind.ExclamationToken ? "!" : node.operator === ts.SyntaxKind.MinusToken ? "-" : "~";
    const operand = generateExpr(node.operand, scope, sf);
    return `{kind:"UnaryExpression",operator:${JSON.stringify(op)},operand:${operand}}`;
  }

  if (ts.isConditionalExpression(node)) {
    const cond = generateExpr(node.condition, scope, sf);
    const consequent = generateExpr(node.whenTrue, scope, sf);
    const alternate = generateExpr(node.whenFalse, scope, sf);
    return `{kind:"ConditionalExpression",condition:${cond},consequent:${consequent},alternate:${alternate}}`;
  }

  if (ts.isArrayLiteralExpression(node)) {
    const elements = node.elements.map((e) => generateExpr(e as ts.Expression, scope, sf)).join(",");
    return `{kind:"ArrayLiteralExpression",elements:[${elements}]}`;
  }

  if (ts.isObjectLiteralExpression(node)) {
    const fields = node.properties
      .filter(ts.isPropertyAssignment)
      .map((p) => {
        const name = JSON.stringify((p.name as ts.Identifier).text);
        const assignment = generateExpr(p.initializer as ts.Expression, scope, sf);
        return `{kind:"FieldExpression",name:${name},assignment:${assignment}}`;
      })
      .join(",");
    return `{kind:"ObjectLiteralExpression",fields:[${fields}]}`;
  }

  if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) return generateAccess(node, scope, sf);

  if (ts.isParenthesizedExpression(node)) return generateExpr(node.expression, scope, sf);
  if (ts.isAsExpression(node)) return generateExpr(node.expression, scope, sf);
  if (ts.isNonNullExpression(node)) return generateExpr(node.expression, scope, sf);

  throw new Error(`@lambdaql/unplugin: unsupported expression kind ${ts.SyntaxKind[node.kind]}`);
}

function generateAccess(
  node: ts.PropertyAccessExpression | ts.CallExpression,
  scope: Scope,
  sf: ts.SourceFile,
): string {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const ctx = generateExpr(node.expression.expression as ts.Expression, scope, sf);
    const method = JSON.stringify(node.expression.name.text);
    const args = node.arguments.map((a) => generateExpr(a as ts.Expression, scope, sf)).join(",");
    return `{kind:"MethodExpression",context:${ctx},method:${method},args:[${args}]}`;
  }
  if (ts.isPropertyAccessExpression(node)) {
    const ctx = generateExpr(node.expression, scope, sf);
    const property = JSON.stringify(node.name.text);
    return `{kind:"PropertyExpression",context:${ctx},property:${property}}`;
  }
  throw new Error("@lambdaql/unplugin: unexpected access node");
}
