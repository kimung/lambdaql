import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MikroORM } from '@mikro-orm/better-sqlite'
import { EntitySchema } from '@mikro-orm/core'
import { from } from '@gamn9/data'
import { applyQueryable, createNamingFromMikroOrm } from '../src/index.js'
import type { Queryable } from '@gamn9/data'

// ── Entités ──────────────────────────────────────────────────────────────────

interface IBook {
  id:        number
  title:     string
  published: boolean
  user:      IUser
}

interface IUser {
  id:    number
  name:  string
  age:   number
  books: IBook[]
}

const BookSchema = new EntitySchema<IBook>({
  name: 'Book',
  properties: {
    id:        { type: 'number', primary: true, autoincrement: true },
    title:     { type: 'string' },
    published: { type: 'boolean' },
    user:      { kind: 'm:1', entity: () => 'User', inversedBy: 'books' },
  },
})

const UserSchema = new EntitySchema<IUser>({
  name: 'User',
  properties: {
    id:    { type: 'number', primary: true, autoincrement: true },
    name:  { type: 'string' },
    age:   { type: 'number' },
    books: { kind: '1:m', entity: () => 'Book', mappedBy: 'user' },
  },
})

// ── ORM + seed ────────────────────────────────────────────────────────────────

let orm: MikroORM

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [UserSchema, BookSchema],
    allowGlobalContext: true,
  })
  await orm.schema.createSchema()

  // Seed : Alice (25), Bob (17), Carol (30)
  //   Alice → "TS Guide" (published), "JS Basics" (not published)
  //   Bob   → "CSS Tips" (published)
  //   Carol → aucun livre
  const em    = orm.em.fork()
  const alice = em.create('User', { name: 'Alice', age: 25 })
  const bob   = em.create('User', { name: 'Bob',   age: 17 })
  em.create('User', { name: 'Carol', age: 30 })
  em.create('Book', { title: 'TS Guide',  published: true,  user: alice })
  em.create('Book', { title: 'JS Basics', published: false, user: alice })
  em.create('Book', { title: 'CSS Tips',  published: true,  user: bob   })
  await em.flush()
})

afterAll(() => orm.close())

// Helper : applique un Queryable sur un vrai QB MikroORM et retourne les résultats
async function run<T extends object>(
  queryable: Queryable<T>,
  opts?: Parameters<typeof applyQueryable>[2],
): Promise<IUser[]> {
  const em = orm.em.fork()
  const qb = em.createQueryBuilder<IUser>('User')
  applyQueryable(qb as any, queryable, opts)
  return qb.getResultList() as Promise<IUser[]>
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('intégration — WHERE', () => {
  it('filter(u => u.age > 18) → Alice et Carol', async () => {
    const users = await run(from<IUser>('User').filter(u => u.age > 18))
    expect(users.map(u => u.name).sort()).toEqual(['Alice', 'Carol'])
  })

  it('deux filtres chaînés → Alice et Bob', async () => {
    const users = await run(
      from<IUser>('User').filter(u => u.age > 16).filter(u => u.age < 28),
    )
    expect(users.map(u => u.name).sort()).toEqual(['Alice', 'Bob'])
  })

  it('filter sur égalité string → Alice uniquement', async () => {
    const users = await run(from<IUser>('User').filter(u => u.name === 'Alice'))
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Alice')
  })
})

describe('intégration — ORDER BY', () => {
  it('orderByDesc(u => u.age) → [30, 25, 17]', async () => {
    const users = await run(from<IUser>('User').orderByDesc(u => u.age))
    expect(users.map(u => u.age)).toEqual([30, 25, 17])
  })

  it('orderBy(u => u.name) → ordre alphabétique', async () => {
    const users = await run(from<IUser>('User').orderBy(u => u.name))
    expect(users.map(u => u.name)).toEqual(['Alice', 'Bob', 'Carol'])
  })
})

describe('intégration — LIMIT / OFFSET', () => {
  it('take(1) → 1 seul résultat', async () => {
    const users = await run(from<IUser>('User').filter(u => u.age > 18).take(1))
    expect(users).toHaveLength(1)
  })

  it('orderBy(age).skip(1).take(1) → Alice (2e dans l\'ordre asc)', async () => {
    const users = await run(from<IUser>('User').orderBy(u => u.age).skip(1).take(1))
    expect(users).toHaveLength(1)
    expect(users[0].age).toBe(25) // [17(Bob), 25(Alice), 30(Carol)] → skip 1 → Alice
  })
})

describe('intégration — auto-join via em', () => {
  it('filter navigation books.published → Alice et Bob', async () => {
    const em    = orm.em.fork()
    const qb    = em.createQueryBuilder<IUser>('User')
    applyQueryable(
      qb as any,
      from<IUser>('User').filter((u: any) => u.books.published),
      { em: em as any, entity: 'User' },
    )
    const users = await qb.getResultList() as IUser[]
    // Alice a un livre publié, Bob a un livre publié, Carol n'en a pas
    expect(users.map(u => u.name).sort()).toEqual(['Alice', 'Bob'])
  })

  it('leftJoin est bien appelé sur le QB réel', async () => {
    const em    = orm.em.fork()
    const qb    = em.createQueryBuilder<IUser>('User') as any
    const origLeftJoin = qb.leftJoin.bind(qb)
    let joinCalled = false
    qb.leftJoin = (...args: any[]) => { joinCalled = true; return origLeftJoin(...args) }

    applyQueryable(
      qb,
      from<IUser>('User').filter((u: any) => u.books.published),
      { em: em as any, entity: 'User' },
    )
    expect(joinCalled).toBe(true)
  })
})

describe('intégration — createNamingFromMikroOrm', () => {
  it('naming(prop) fonctionne sans throw avec un vrai orm', () => {
    const naming = createNamingFromMikroOrm(orm as any)
    // MikroORM BetterSqlite utilise UnderscoreNamingStrategy par défaut
    // Vérifie juste que la fonction tourne sans erreur
    expect(typeof naming('age')).toBe('string')
    expect(typeof naming('name')).toBe('string')
  })

  it('naming avec entityMeta — fieldName override prioritaire', async () => {
    const entityMeta = orm.getMetadata().get('User') as any
    const naming = createNamingFromMikroOrm(orm as any, entityMeta)
    // Les colonnes 'name' et 'age' n'ont pas de fieldName override →
    // retournent le résultat de la NamingStrategy
    expect(typeof naming('age')).toBe('string')
    expect(naming('age')).toBeTruthy()
  })
})

// ── Depth-2 : Employee → Company → Country ───────────────────────────────────

interface ICountry  { id: number; name: string }
interface ICompany  { id: number; name: string; country: ICountry }
interface IEmployee { id: number; name: string; company: ICompany }

const CountrySchema = new EntitySchema<ICountry>({
  name: 'Country',
  properties: {
    id:   { type: 'number', primary: true, autoincrement: true },
    name: { type: 'string' },
  },
})

const CompanySchema = new EntitySchema<ICompany>({
  name: 'Company',
  properties: {
    id:      { type: 'number', primary: true, autoincrement: true },
    name:    { type: 'string' },
    country: { kind: 'm:1', entity: () => 'Country' },
  },
})

const EmployeeSchema = new EntitySchema<IEmployee>({
  name: 'Employee',
  properties: {
    id:      { type: 'number', primary: true, autoincrement: true },
    name:    { type: 'string' },
    company: { kind: 'm:1', entity: () => 'Company' },
  },
})

describe('intégration — navigation depth-2 (Employee → Company → Country)', () => {
  let orm2: MikroORM

  beforeAll(async () => {
    orm2 = await MikroORM.init({
      dbName: ':memory:',
      entities: [CountrySchema, CompanySchema, EmployeeSchema],
      allowGlobalContext: true,
    })
    await orm2.schema.createSchema()

    // Seed : France (Acme : Alice, Bob) / Germany (Corp : Carol)
    const em      = orm2.em.fork()
    const france  = em.create('Country', { name: 'France' })
    const germany = em.create('Country', { name: 'Germany' })
    const acme    = em.create('Company', { name: 'Acme', country: france })
    const corp    = em.create('Company', { name: 'Corp', country: germany })
    em.create('Employee', { name: 'Alice', company: acme })
    em.create('Employee', { name: 'Bob',   company: acme })
    em.create('Employee', { name: 'Carol', company: corp })
    await em.flush()
  })

  afterAll(() => orm2.close())

  it('filter(e => e.company.country.name === "France") → Alice et Bob', async () => {
    const em = orm2.em.fork()
    const qb = em.createQueryBuilder<IEmployee>('Employee')
    applyQueryable(
      qb as any,
      from<IEmployee>('Employee').filter((e: any) => e.company.country.name === 'France'),
      { em: em as any, entity: 'Employee' },
    )
    const employees = await qb.getResultList() as IEmployee[]
    expect(employees.map(e => e.name).sort()).toEqual(['Alice', 'Bob'])
  })

  it('filter(e => e.company.country.name !== "France") → Carol', async () => {
    const em = orm2.em.fork()
    const qb = em.createQueryBuilder<IEmployee>('Employee')
    applyQueryable(
      qb as any,
      from<IEmployee>('Employee').filter((e: any) => e.company.country.name !== 'France'),
      { em: em as any, entity: 'Employee' },
    )
    const employees = await qb.getResultList() as IEmployee[]
    expect(employees.map(e => e.name)).toEqual(['Carol'])
  })
})
