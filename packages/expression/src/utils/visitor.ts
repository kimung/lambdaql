import type { Expression }             from '../parser/expression/index.js'
import type { NameExpression }          from '../parser/expression/name.js'
import type { ConstantExpression }      from '../parser/expression/constant.js'
import type { BinaryExpression }        from '../parser/expression/binary.js'
import type { UnaryExpression }         from '../parser/expression/unary.js'
import type { PropertyExpression }      from '../parser/expression/property.js'
import type { MethodExpression }        from '../parser/expression/method.js'
import type { FieldExpression }         from '../parser/expression/field.js'
import type { ObjectLiteralExpression } from '../parser/expression/object.js'
import type { LambdaExpression }        from '../parser/expression/lambda.js'
import type { ConditionalExpression }   from '../parser/expression/conditional.js'
import type { NullishExpression }       from '../parser/expression/nullish.js'
import type { ArrayLiteralExpression }  from '../parser/expression/array.js'

export interface ExpressionVisitor<T> {
  visitName(expr: NameExpression): T
  visitConstant(expr: ConstantExpression): T
  visitBinary(expr: BinaryExpression): T
  visitUnary(expr: UnaryExpression): T
  visitProperty(expr: PropertyExpression): T
  visitMethod(expr: MethodExpression): T
  visitField(expr: FieldExpression): T
  visitObjectLiteral(expr: ObjectLiteralExpression): T
  visitLambda(expr: LambdaExpression): T
  visitConditional(expr: ConditionalExpression): T
  visitNullish(expr: NullishExpression): T
  visitArrayLiteral(expr: ArrayLiteralExpression): T
}

export function visit<T>(expr: Expression, visitor: ExpressionVisitor<T>): T {
  switch (expr.kind) {
    case 'NameExpression':          return visitor.visitName(expr as NameExpression)
    case 'ConstantExpression':      return visitor.visitConstant(expr as ConstantExpression)
    case 'BinaryExpression':        return visitor.visitBinary(expr as BinaryExpression)
    case 'UnaryExpression':         return visitor.visitUnary(expr as UnaryExpression)
    case 'PropertyExpression':      return visitor.visitProperty(expr as PropertyExpression)
    case 'MethodExpression':        return visitor.visitMethod(expr as MethodExpression)
    case 'FieldExpression':         return visitor.visitField(expr as FieldExpression)
    case 'ObjectLiteralExpression': return visitor.visitObjectLiteral(expr as ObjectLiteralExpression)
    case 'LambdaExpression':        return visitor.visitLambda(expr as LambdaExpression)
    case 'ConditionalExpression':   return visitor.visitConditional(expr as ConditionalExpression)
    case 'NullishExpression':       return visitor.visitNullish(expr as NullishExpression)
    case 'ArrayLiteralExpression':  return visitor.visitArrayLiteral(expr as ArrayLiteralExpression)
    default: throw new Error(`Unknown expression kind: ${(expr as any).kind}`)
  }
}
