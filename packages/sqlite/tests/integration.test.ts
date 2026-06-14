import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { createDatabase } from '@gamn9/data'
import { createSqliteExecutor } from '../src/index.js'

type User = { id: number; name: string; age: number; email: string | null }
type Post = { id: number; userId: number; title: string }

let db: InstanceType<typeof Database>

beforeAll(() => {
  db = new Database(':memory:')
  db.exec(`
    CREATE TABLE user (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL, email TEXT);
    INSERT INTO user VALUES (1, 'Alice', 30, 'alice@example.com');
    INSERT INTO user VALUES (2, 'Bob', 17, NULL);
    INSERT INTO user VALUES (3, 'Carol', 25, 'carol@example.com');
    INSERT INTO user VALUES (4, 'Dave', 18, 'dave@example.com');

    CREATE TABLE post (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, title TEXT NOT NULL);
    INSERT INTO post VALUES (1, 1, 'Hello World');
    INSERT INTO post VALUES (2, 1, 'Second Post');
    INSERT INTO post VALUES (3, 3, 'Carol Post');
  `)
})

afterAll(() => db.close())

describe('Integration SQLite — toArray()', () => {
  it('SELECT * sans filtre', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const users = await q.from<User>('user').toArray()
    expect(users).toHaveLength(4)
  })

  it('filter WHERE age > 18', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const users = await q.from<User>('user').filter(u => u.age > 18).toArray()
    expect(users.map((u: any) => u.name).sort()).toEqual(['Alice', 'Carol'])
  })

  it('filter IS NULL', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const users = await q.from<User>('user').filter(u => u.email === null).toArray()
    expect(users).toHaveLength(1)
    expect((users[0] as any).name).toBe('Bob')
  })

  it('orderBy ASC', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const users = await q.from<User>('user').orderBy(u => u.age).toArray()
    const ages = users.map((u: any) => u.age)
    expect(ages).toEqual([17, 18, 25, 30])
  })

  it('take + skip (LIMIT/OFFSET)', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const users = await q.from<User>('user').orderBy(u => u.id).take(2).skip(1).toArray()
    expect(users).toHaveLength(2)
    expect((users[0] as any).id).toBe(2)
  })

  it('LIKE via includes()', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const users = await q.from<User>('user').filter((u: any) => u.name.includes('a')).toArray()
    // Alice, Carol, Dave contiennent 'a'
    expect(users).toHaveLength(3)
  })

  it('IN via [].includes()', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const users = await q.from<User>('user').filter((u: any) => [1, 3].includes(u.id)).toArray()
    expect(users).toHaveLength(2)
    expect(users.map((u: any) => u.id).sort()).toEqual([1, 3])
  })

  it('placeholders ? en bonne position (sous-requête + filtre externe)', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const inner = q.from<Post>('post').filter((p: any) => p.userId === 1).select((p: any) => ({ userId: p.userId }))
    const users = await q.from<User>('user')
      .filter(u => u.age > 20)
      .whereIn((u: any) => u.id, inner)
      .toArray()
    // Alice (age 30, userId 1) doit apparaître
    expect(users).toHaveLength(1)
    expect((users[0] as any).name).toBe('Alice')
  })
})

describe('Integration SQLite — first() / firstOrDefault()', () => {
  it('first() retourne le premier résultat', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const user = await q.from<User>('user').orderBy(u => u.id).first()
    expect((user as any).id).toBe(1)
  })

  it('first() lève une erreur si vide', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    await expect(
      q.from<User>('user').filter(u => u.age > 100).first()
    ).rejects.toThrow('Sequence contains no elements')
  })

  it('firstOrDefault() retourne undefined si vide', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const result = await q.from<User>('user').filter(u => u.age > 100).firstOrDefault()
    expect(result).toBeUndefined()
  })
})

describe('Integration SQLite — count()', () => {
  it('count() total', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const n = await q.from<User>('user').count()
    expect(n).toBe(4)
  })

  it('count() avec filtre', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    const n = await q.from<User>('user').filter(u => u.age >= 18).count()
    expect(n).toBe(3)
  })
})

describe('Integration SQLite — any()', () => {
  it('any() retourne true quand il y a des résultats', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    expect(await q.from<User>('user').any()).toBe(true)
  })

  it('any() retourne false quand vide', async () => {
    const q = createDatabase(createSqliteExecutor(db))
    expect(await q.from<User>('user').filter(u => u.age > 100).any()).toBe(false)
  })
})
