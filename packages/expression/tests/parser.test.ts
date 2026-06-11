import { describe, it, expect } from 'vitest'
import { Lexer } from '../src/lexer/index.js'
import { LambdaParser } from '../src/parser/lambda.js'

function parse(src: string) {
  return new LambdaParser(new Lexer(src)).parse()
}

describe('Parser — LambdaExpression', () => {
  it('parses args correctly', () => {
    const ast = parse('u => u')
    expect(ast.kind).toBe('LambdaExpression')
    expect(ast.args[0]!.name).toBe('u')
  })

  it('parses binary >=', () => {
    const ast = parse('u => u.age >= 18')
    expect(ast.body.kind).toBe('BinaryExpression')
  })

  it('parses && with two predicates', () => {
    const ast = parse('u => u.age >= 18 && u.active === true')
    expect(ast.body.kind).toBe('BinaryExpression')
    const bin = ast.body as any
    expect(bin.operator).toBe('&&')
  })

  it('parses || operator', () => {
    const ast = parse('u => u.admin === true || u.role === "mod"')
    const bin = ast.body as any
    expect(bin.operator).toBe('||')
  })

  it('parses property access chain', () => {
    const ast = parse('u => u.address.city')
    expect(ast.body.kind).toBe('PropertyExpression')
  })

  it('parses unary !', () => {
    const ast = parse('u => !u.deleted')
    expect(ast.body.kind).toBe('UnaryExpression')
    const un = ast.body as any
    expect(un.operator).toBe('!')
  })

  it('parses method call includes()', () => {
    const ast = parse('u => u.email.includes("gmail")')
    expect(ast.body.kind).toBe('MethodExpression')
    const m = ast.body as any
    expect(m.method).toBe('includes')
  })

  it('parses object projection', () => {
    const ast = parse('u => ({ id: u.id, name: u.name })')
    expect(ast.body.kind).toBe('ObjectLiteralExpression')
    const obj = ast.body as any
    expect(obj.fields).toHaveLength(2)
  })

  it('parses multi-param lambda', () => {
    const ast = parse('(a, b) => a + b')
    expect(ast.args).toHaveLength(2)
    expect(ast.args[0]!.name).toBe('a')
    expect(ast.args[1]!.name).toBe('b')
  })

  it('parses ternary (conditional)', () => {
    const ast = parse('u => u.age >= 18 ? "adult" : "minor"')
    expect(ast.body.kind).toBe('ConditionalExpression')
  })

  it('parses arithmetic', () => {
    const ast = parse('x => x + 1')
    expect(ast.body.kind).toBe('BinaryExpression')
    const bin = ast.body as any
    expect(bin.operator).toBe('+')
  })

  it('parses string constant', () => {
    const ast = parse('u => u.name === "Kim"')
    const bin = ast.body as any
    expect(bin.right.kind).toBe('ConstantExpression')
    expect(bin.right.value).toBe('Kim')
  })

  it('erreur avec position line:col sur token inattendu', () => {
    // ')' n'a pas de prefix parselet — doit inclure la position
    expect(() => parse('u => )')).toThrow(/at 1:\d+/)
  })

  it('parse un tableau littéral', () => {
    const ast = parse('u => [1, 2, 3]')
    expect(ast.body.kind).toBe('ArrayLiteralExpression')
    const arr = ast.body as any
    expect(arr.elements).toHaveLength(3)
    expect(arr.elements[0].value).toBe(1)
  })

  it('parse [].includes(u.id) comme MethodExpression', () => {
    const ast = parse('u => [1, 2].includes(u.id)')
    expect(ast.body.kind).toBe('MethodExpression')
    const m = ast.body as any
    expect(m.method).toBe('includes')
    expect(m.context.kind).toBe('ArrayLiteralExpression')
  })

  it('parse le chaînage optionnel ?.', () => {
    const ast = parse('u => u?.name')
    expect(ast.body.kind).toBe('PropertyExpression')
    const p = ast.body as any
    expect(p.property).toBe('name')
  })

  it('parse u?.name.toLowerCase() via ?.', () => {
    const ast = parse('u => u?.name.toLowerCase()')
    expect(ast.body.kind).toBe('MethodExpression')
    const m = ast.body as any
    expect(m.method).toBe('toLowerCase')
  })
})
