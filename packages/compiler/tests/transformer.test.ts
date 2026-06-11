import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import transformer from '../src/index.js'

// Déclarations stub pour que le TypeChecker reconnaisse Queryable<T>
const QUERYABLE_STUB = `
declare class Queryable<T> {
  filter(p: any): Queryable<T>
  select<U>(s: any): Queryable<U>
  join<U>(other: Queryable<U>, on: any): Queryable<T>
  leftJoin<U>(other: Queryable<U>, on: any): Queryable<T>
  groupBy(s: any): Queryable<T>
  having(p: any): Queryable<T>
  orderBy(s: any): Queryable<T>
  orderByDesc(s: any): Queryable<T>
}
declare const q: Queryable<{ id: any; name: any; age: any; active: any; email: any; deletedAt: any }>
declare const other: Queryable<{ userId: any }>
`

// Compile userSource avec un vrai ts.Program (TypeChecker disponible).
// Le stub Queryable est injecté en tête du fichier virtuel.
function compileSource(userSource: string): string {
  const fullSource = QUERYABLE_STUB + '\n' + userSource
  const opts: ts.CompilerOptions = {
    target:       ts.ScriptTarget.ES2022,
    module:       ts.ModuleKind.ESNext,
    noLib:        true,
    skipLibCheck: true,
    strict:       false,
  }
  const host    = ts.createCompilerHost(opts)
  const sf      = ts.createSourceFile('test.ts', fullSource, ts.ScriptTarget.ES2022, true)
  const origGet = host.getSourceFile.bind(host)
  const origEx  = host.fileExists.bind(host)
  const origRd  = host.readFile.bind(host)

  host.getSourceFile = (name, v) => name === 'test.ts' ? sf : origGet(name, v)
  host.fileExists    = (name)    => name === 'test.ts' || origEx(name)
  host.readFile      = (name)    => name === 'test.ts' ? fullSource : origRd(name)

  let output = ''
  const prog = ts.createProgram(['test.ts'], opts, host)
  prog.emit(
    undefined,
    (_f, text) => { output = text },
    undefined,
    false,
    { before: [transformer(prog)] },
  )
  return output.trim()
}

// Évalue l'argument transformé du dernier appel de méthode dans le JS émis.
function extractArg(source: string): any {
  const js = compileSource(source)
  const match = js.match(/\.\w+\((\{[\s\S]*\})\)/)
  if (!match) throw new Error(`Aucun appel transformé dans : ${js}`)
  return eval(`(${match[1]})`)  // eslint-disable-line no-eval
}

describe('Transformer — propriétés simples', () => {
  it('transforme u => u.active en LambdaExpression', () => {
    const ast = extractArg(`q.filter(u => u.active)`)
    expect(ast.kind).toBe('LambdaExpression')
    expect(ast.args[0].name).toBe('u')
    expect(ast.body.kind).toBe('PropertyExpression')
    expect(ast.body.property).toBe('active')
  })

  it('transforme une comparaison binaire', () => {
    const ast = extractArg(`q.filter(u => u.age > 18)`)
    expect(ast.body.kind).toBe('BinaryExpression')
    expect(ast.body.operator).toBe('>')
    expect(ast.body.right.kind).toBe('ConstantExpression')
    expect(ast.body.right.value).toBe(18)
  })

  it('transforme une chaîne de méthode (includes)', () => {
    const ast = extractArg(`q.filter(u => u.email.includes('gmail'))`)
    expect(ast.body.kind).toBe('MethodExpression')
    expect(ast.body.method).toBe('includes')
    expect(ast.body.args[0].value).toBe('gmail')
  })

  it('transforme un NOT unaire', () => {
    const ast = extractArg(`q.filter(u => !u.active)`)
    expect(ast.body.kind).toBe('UnaryExpression')
    expect(ast.body.operator).toBe('!')
  })

  it('transforme un opérateur AND (&&)', () => {
    const ast = extractArg(`q.filter(u => u.age >= 18 && u.active)`)
    expect(ast.body.kind).toBe('BinaryExpression')
    expect(ast.body.operator).toBe('&&')
  })

  it('transforme === null', () => {
    const ast = extractArg(`q.filter(u => u.deletedAt === null)`)
    expect(ast.body.kind).toBe('BinaryExpression')
    expect(ast.body.right.kind).toBe('ConstantExpression')
    expect(ast.body.right.value).toBeNull()
  })

  it('transforme un tableau littéral (IN)', () => {
    const ast = extractArg(`q.filter(u => [1,2,3].includes(u.id))`)
    expect(ast.body.kind).toBe('MethodExpression')
    expect(ast.body.context.kind).toBe('ArrayLiteralExpression')
    expect(ast.body.context.elements).toHaveLength(3)
  })

  it('transforme un select avec objet littéral', () => {
    const ast = extractArg(`q.select(u => ({ id: u.id, name: u.name }))`)
    expect(ast.body.kind).toBe('ObjectLiteralExpression')
    expect(ast.body.fields).toHaveLength(2)
    expect(ast.body.fields[0].name).toBe('id')
  })
})

describe('Transformer — closures', () => {
  it('capture un identifiant externe comme ConstantExpression live', () => {
    // La référence `limit` doit apparaître dans le code émis (non inlinée)
    const js = compileSource(`const limit = 18; q.filter(u => u.age > limit)`)
    expect(js).toMatch(/value:\s*limit/)
  })

  it('évalue correctement la closure au runtime', () => {
    const limit = 21
    const ast = extractArg(`q.filter(u => u.age > ${limit})`)
    expect(ast.body.right.value).toBe(21)
  })
})

describe('Transformer — méthodes multi-params (join)', () => {
  it('transforme le second argument de join', () => {
    const js = compileSource(`q.join(other, (u, p) => u.id === p.userId)`)
    expect(js).toMatch(/LambdaExpression/)
    expect(js).toMatch(/BinaryExpression/)
  })
})

describe('Transformer — non-régression (faux positifs)', () => {
  it('ne transforme pas .filter() sur un tableau (non-Queryable)', () => {
    // `any` → getSymbol() renvoie undefined → isQueryable() = false
    const js = compileSource(`
      declare const nums: any
      nums.filter(x => x > 0)
    `)
    expect(js).not.toMatch(/LambdaExpression/)
    expect(js).toMatch(/=> x > 0/)
  })

  it('ne transforme pas .filter() sur un objet quelconque', () => {
    const js = compileSource(`
      declare const repo: { filter(fn: (x: any) => any): any[] }
      repo.filter(x => x > 0)
    `)
    expect(js).not.toMatch(/LambdaExpression/)
  })

  it('transforme bien .filter() sur Queryable (positif)', () => {
    const js = compileSource(`q.filter(u => u.active)`)
    expect(js).toMatch(/LambdaExpression/)
    expect(js).toMatch(/PropertyExpression/)
  })
})
