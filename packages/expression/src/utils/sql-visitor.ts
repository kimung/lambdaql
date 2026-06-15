import { visit, type ExpressionVisitor } from './visitor.js'
import type { Expression }               from '../parser/expression/index.js'
import type { NameExpression }           from '../parser/expression/name.js'
import type { ConstantExpression }       from '../parser/expression/constant.js'
import type { BinaryExpression }         from '../parser/expression/binary.js'
import type { UnaryExpression }          from '../parser/expression/unary.js'
import type { PropertyExpression }       from '../parser/expression/property.js'
import type { MethodExpression }         from '../parser/expression/method.js'
import type { FieldExpression }          from '../parser/expression/field.js'
import type { ObjectLiteralExpression }  from '../parser/expression/object.js'
import type { LambdaExpression }         from '../parser/expression/lambda.js'
import type { ConditionalExpression }    from '../parser/expression/conditional.js'
import type { NullishExpression }        from '../parser/expression/nullish.js'
import type { ArrayLiteralExpression }    from '../parser/expression/array.js'
import type { TemplateLiteralExpression } from '../parser/expression/template.js'

const SQL_OPS: Record<string, string> = {
  '&&': 'AND', '||': 'OR', '===': '=', '!==': '!=', '==': '=', '!=': '!=',
}

function unquote(s: string): string {
  const raw = s.startsWith("'") && s.endsWith("'") ? s.slice(1, -1) : s
  return raw.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

class SqlVisitor implements ExpressionVisitor<string> {
  constructor(private readonly paramName: string) {}

  visitName(expr: NameExpression): string {
    return expr.name === this.paramName ? '' : expr.name
  }

  visitConstant(expr: ConstantExpression): string {
    if (expr.value === null || expr.value === undefined) return 'NULL'
    if (typeof expr.value === 'string') return `'${expr.value.replace(/'/g, "''")}'`
    if (typeof expr.value === 'boolean') return expr.value ? '1' : '0'
    return String(expr.value)
  }

  visitBinary(expr: BinaryExpression): string {
    // '??' est produit comme BinaryExpression par le parser → COALESCE
    if (expr.operator === '??')
      return `COALESCE(${visit(expr.left, this)}, ${visit(expr.right, this)})`
    const op = SQL_OPS[expr.operator] ?? expr.operator
    return `(${visit(expr.left, this)} ${op} ${visit(expr.right, this)})`
  }

  visitUnary(expr: UnaryExpression): string {
    const operand = visit(expr.operand, this)
    return expr.operator === '!' ? `NOT (${operand})` : `${expr.operator}${operand}`
  }

  visitProperty(expr: PropertyExpression): string {
    const ctx = visit(expr.context, this)
    return ctx ? `${ctx}.${expr.property}` : expr.property
  }

  visitMethod(expr: MethodExpression): string {
    const ctx  = visit(expr.context, this)
    const args = expr.args.map(a => visit(a, this))
    const map: Record<string, (...a: string[]) => string> = {
      includes:    (a) => `${ctx} LIKE '%${unquote(a!)}%'`,
      startsWith:  (a) => `${ctx} LIKE '${unquote(a!)}%'`,
      endsWith:    (a) => `${ctx} LIKE '%${unquote(a!)}'`,
      toLowerCase: ()  => `LOWER(${ctx})`,
      toUpperCase: ()  => `UPPER(${ctx})`,
    }
    return map[expr.method]?.(...args) ?? `${ctx}.${expr.method}(${args.join(', ')})`
  }

  visitField(expr: FieldExpression): string {
    return `${expr.name} = ${visit(expr.assignment, this)}`
  }

  visitObjectLiteral(expr: ObjectLiteralExpression): string {
    return expr.fields.map(f => visit(f, this)).join(', ')
  }

  visitLambda(expr: LambdaExpression): string {
    return visit(expr.body, this)
  }

  visitConditional(expr: ConditionalExpression): string {
    return `CASE WHEN ${visit(expr.condition, this)} THEN ${visit(expr.consequent, this)} ELSE ${visit(expr.alternate, this)} END`
  }

  visitNullish(expr: NullishExpression): string {
    return `COALESCE(${visit(expr.left, this)}, ${visit(expr.right, this)})`
  }

  visitArrayLiteral(expr: ArrayLiteralExpression): string {
    return `(${expr.elements.map(e => visit(e, this)).join(', ')})`
  }

  visitTemplateLiteral(expr: TemplateLiteralExpression): string {
    const parts: string[] = []
    for (let i = 0; i < expr.quasis.length; i++) {
      if (expr.quasis[i]) parts.push(`'${expr.quasis[i]!.replace(/'/g, "''")}'`)
      if (i < expr.expressions.length) parts.push(visit(expr.expressions[i]!, this))
    }
    return parts.length === 1 ? parts[0]! : parts.join(' || ')
  }
}

export function toSql(expr: Expression, paramName = 'x'): string {
  return visit(expr, new SqlVisitor(paramName))
}
