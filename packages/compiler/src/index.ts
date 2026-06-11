import * as ts from 'typescript'

// Méthodes de Queryable dont le premier argument (ou second pour join) est une lambda à transformer
const QUERYABLE_METHODS = new Set([
  'filter', 'select', 'groupBy', 'having', 'orderBy', 'orderByDesc',
])
// Pour join/leftJoin, c'est le second argument (index 1) qui est la lambda
const JOIN_METHODS = new Set(['join', 'leftJoin'])

export default function(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
  // TypeChecker disponible uniquement avec un vrai ts.Program (tsc + ts-patch).
  // transpileModule / ESBuild ne fournissent pas de vrai checker → on skip la transformation,
  // le fallback runtime de @gamn9/data prend le relais.
  let checker: ts.TypeChecker | undefined
  try {
    const c = program.getTypeChecker()
    checker = typeof c?.getTypeAtLocation === 'function' ? c : undefined
  } catch { /* transpileModule ou programme factice */ }

  return (context) => (sourceFile) => {
    function visit(node: ts.Node): ts.Node {
      if (checker && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method   = node.expression.name.text
        const receiver = node.expression.expression
        if (isQueryable(checker, receiver)) {
          if (QUERYABLE_METHODS.has(method)) {
            const [first, ...rest] = node.arguments
            if (first && ts.isArrowFunction(first)) {
              const params = collectParams(first)
              return ts.factory.updateCallExpression(
                node, node.expression, node.typeArguments,
                [transformLambda(first, params, context), ...rest],
              )
            }
          }
          if (JOIN_METHODS.has(method) && node.arguments.length >= 2) {
            const onArg = node.arguments[1]!
            if (ts.isArrowFunction(onArg)) {
              const params = collectParams(onArg)
              const newArgs = [
                node.arguments[0]!,
                transformLambda(onArg, params, context),
                ...Array.from(node.arguments).slice(2),
              ]
              return ts.factory.updateCallExpression(
                node, node.expression, node.typeArguments, newArgs,
              )
            }
          }
        }
      }
      return ts.visitEachChild(node, visit, context)
    }
    return ts.visitNode(sourceFile, visit) as ts.SourceFile
  }
}

function isQueryable(checker: ts.TypeChecker, node: ts.Expression): boolean {
  const type   = checker.getTypeAtLocation(node)
  const symbol = type.getSymbol() ?? type.aliasSymbol
  return symbol?.getName() === 'Queryable'
}

// ── helpers ──────────────────────────────────────────────────────────────────

function collectParams(fn: ts.ArrowFunction): Set<string> {
  const names = new Set<string>()
  for (const p of fn.parameters) {
    if (ts.isIdentifier(p.name)) names.add(p.name.text)
  }
  return names
}

function transformLambda(
  fn: ts.ArrowFunction,
  params: Set<string>,
  context: ts.TransformationContext,
): ts.Expression {
  const args = fn.parameters.map(p =>
    obj('NameExpression', [prop('name', str((p.name as ts.Identifier).text))])
  )
  const body = transformExpr(fn.body as ts.Expression, params, context)
  return obj('LambdaExpression', [
    prop('args', ts.factory.createArrayLiteralExpression(args)),
    prop('body', body),
  ])
}

function transformExpr(
  node: ts.Expression,
  params: Set<string>,
  context: ts.TransformationContext,
): ts.Expression {
  // Identifier
  if (ts.isIdentifier(node)) {
    if (params.has(node.text))
      return obj('NameExpression', [prop('name', str(node.text))])
    // Closure : identifiant externe — garder la référence vive, emballer en ConstantExpression
    return obj('ConstantExpression', [prop('value', node)])
  }

  // Literals
  if (ts.isNumericLiteral(node))
    return obj('ConstantExpression', [prop('value', ts.factory.createNumericLiteral(node.text))])
  if (ts.isStringLiteral(node))
    return obj('ConstantExpression', [prop('value', str(node.text))])
  if (node.kind === ts.SyntaxKind.TrueKeyword)
    return obj('ConstantExpression', [prop('value', ts.factory.createTrue())])
  if (node.kind === ts.SyntaxKind.FalseKeyword)
    return obj('ConstantExpression', [prop('value', ts.factory.createFalse())])
  if (node.kind === ts.SyntaxKind.NullKeyword)
    return obj('ConstantExpression', [prop('value', ts.factory.createNull())])

  // Binary  (u.age > 18, u.name === 'Kim', …)
  if (ts.isBinaryExpression(node)) {
    return obj('BinaryExpression', [
      prop('operator', str(node.operatorToken.getText())),
      prop('left',     transformExpr(node.left,  params, context)),
      prop('right',    transformExpr(node.right, params, context)),
    ])
  }

  // Unary  (!u.active, -n)
  if (ts.isPrefixUnaryExpression(node)) {
    const op = node.operator === ts.SyntaxKind.ExclamationToken ? '!'
             : node.operator === ts.SyntaxKind.MinusToken       ? '-'
             : '~'
    return obj('UnaryExpression', [
      prop('operator', str(op)),
      prop('operand',  transformExpr(node.operand, params, context)),
    ])
  }

  // Conditional  (a ? b : c)
  if (ts.isConditionalExpression(node)) {
    return obj('ConditionalExpression', [
      prop('condition',  transformExpr(node.condition,  params, context)),
      prop('consequent', transformExpr(node.whenTrue,   params, context)),
      prop('alternate',  transformExpr(node.whenFalse,  params, context)),
    ])
  }

  // Nullish (??)
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    return obj('NullishExpression', [
      prop('left',  transformExpr(node.left,  params, context)),
      prop('right', transformExpr(node.right, params, context)),
    ])
  }

  // Array literal  ([1, 2, 3])
  if (ts.isArrayLiteralExpression(node)) {
    return obj('ArrayLiteralExpression', [
      prop('elements', ts.factory.createArrayLiteralExpression(
        node.elements.map(e => transformExpr(e as ts.Expression, params, context))
      )),
    ])
  }

  // Object literal  ({ id: u.id, name: u.name })
  if (ts.isObjectLiteralExpression(node)) {
    const fields = node.properties
      .filter(ts.isPropertyAssignment)
      .map(p => obj('FieldExpression', [
        prop('name',       str((p.name as ts.Identifier).text)),
        prop('assignment', transformExpr(p.initializer as ts.Expression, params, context)),
      ]))
    return obj('ObjectLiteralExpression', [
      prop('fields', ts.factory.createArrayLiteralExpression(fields)),
    ])
  }

  // Property / Method access  (u.name, u.email.includes('x'))
  if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) {
    return transformAccess(node, params, context)
  }

  // Parenthesised expression
  if (ts.isParenthesizedExpression(node))
    return transformExpr(node.expression, params, context)

  // Fallback : laisser le nœud tel quel (ex : expressions non reconnues)
  throw new Error(`@gamn9/compiler: unsupported expression kind ${ts.SyntaxKind[node.kind]}`)
}

function transformAccess(
  node: ts.PropertyAccessExpression | ts.CallExpression,
  params: Set<string>,
  context: ts.TransformationContext,
): ts.Expression {
  // Method call : context.method(args)
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const ctx    = transformExpr(node.expression.expression as ts.Expression, params, context)
    const method = node.expression.name.text
    const args   = node.arguments.map(a => transformExpr(a as ts.Expression, params, context))
    return obj('MethodExpression', [
      prop('context', ctx),
      prop('method',  str(method)),
      prop('args',    ts.factory.createArrayLiteralExpression(args)),
    ])
  }
  // Property access : context.property
  if (ts.isPropertyAccessExpression(node)) {
    const ctx = transformExpr(node.expression, params, context)
    return obj('PropertyExpression', [
      prop('context',  ctx),
      prop('property', str(node.name.text)),
    ])
  }
  throw new Error(`@gamn9/compiler: unexpected access node`)
}

// ── AST factory helpers ───────────────────────────────────────────────────────

function obj(kind: string, props: ts.ObjectLiteralElementLike[]): ts.ObjectLiteralExpression {
  return ts.factory.createObjectLiteralExpression([
    prop('kind', str(kind)),
    ...props,
  ])
}

function prop(key: string, value: ts.Expression): ts.PropertyAssignment {
  return ts.factory.createPropertyAssignment(key, value)
}

function str(value: string): ts.StringLiteral {
  return ts.factory.createStringLiteral(value)
}
