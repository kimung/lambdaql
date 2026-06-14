import { describe, it, expect, vi } from 'vitest'
import { createDatabase, from } from '../src/queryable.js'
import { sqlite } from '../src/sql/dialect.js'
import type { Executor } from '../src/executor.js'

type User = { id: number; name: string; age: number }

function mockExecutor(rows: unknown[]): Executor {
  return {
    dialect: sqlite,
    query: vi.fn().mockResolvedValue({ rows }),
  }
}

describe('createDatabase + toArray()', () => {
  it('retourne les lignes du executor', async () => {
    const exec = mockExecutor([{ id: 1, name: 'Alice', age: 30 }, { id: 2, name: 'Bob', age: 25 }])
    const db = createDatabase(exec)
    const users = await db.from<User>('user').filter(u => u.age > 20).toArray()
    expect(users).toHaveLength(2)
    expect(users[0]).toEqual({ id: 1, name: 'Alice', age: 30 })
  })

  it('envoie le bon SQL et les bons params au executor', async () => {
    const exec = mockExecutor([])
    const db = createDatabase(exec)
    await db.from<User>('user').filter(u => u.age >= 18).toArray()
    expect(exec.query).toHaveBeenCalledWith(
      'SELECT * FROM user AS t0 WHERE (t0.age >= ?)',
      [18],
    )
  })

  it('propage le naming depuis createDatabase', async () => {
    const naming = (p: string) => p.toUpperCase()
    const exec = mockExecutor([])
    const db = createDatabase(exec, { naming })
    await db.from<User>('user').filter(u => u.age > 0).toArray()
    const [sql] = (exec.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(sql).toContain('t0.AGE')
  })

  it('from() sans createDatabase fonctionne toujours pour toSql()', () => {
    const { sql } = from<User>('user').filter(u => u.age > 0).toSql()
    expect(sql).toContain('SELECT')
  })
})

describe('first() / firstOrDefault()', () => {
  it('first() retourne le premier élément', async () => {
    const exec = mockExecutor([{ id: 1, name: 'Alice', age: 30 }])
    const db = createDatabase(exec)
    const user = await db.from<User>('user').first()
    expect(user).toEqual({ id: 1, name: 'Alice', age: 30 })
    // Vérifie que LIMIT 1 a bien été appliqué
    const [sql] = (exec.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(sql).toContain('LIMIT 1')
  })

  it('first() lève une erreur si vide', async () => {
    const exec = mockExecutor([])
    const db = createDatabase(exec)
    await expect(db.from<User>('user').first()).rejects.toThrow('Sequence contains no elements')
  })

  it('firstOrDefault() retourne undefined si vide', async () => {
    const exec = mockExecutor([])
    const db = createDatabase(exec)
    const user = await db.from<User>('user').firstOrDefault()
    expect(user).toBeUndefined()
  })
})

describe('count()', () => {
  it('exécute SELECT COUNT(*) AS count FROM (...) AS sub', async () => {
    const exec = mockExecutor([{ count: 42 }])
    const db = createDatabase(exec)
    const n = await db.from<User>('user').filter(u => u.age > 18).count()
    expect(n).toBe(42)
    const [sql] = (exec.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(sql).toMatch(/^SELECT COUNT\(\*\) AS count FROM \(/)
  })

  it('retire ORDER BY de la sous-requête', async () => {
    const exec = mockExecutor([{ count: 5 }])
    const db = createDatabase(exec)
    await db.from<User>('user').orderBy(u => u.name).count()
    const [sql] = (exec.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(sql).not.toContain('ORDER BY')
  })

  it('gère les count PostgreSQL en string', async () => {
    const exec = mockExecutor([{ count: '7' }])
    const db = createDatabase(exec)
    const n = await db.from<User>('user').count()
    expect(n).toBe(7)
    expect(typeof n).toBe('number')
  })
})

describe('any()', () => {
  it('retourne true si des lignes existent', async () => {
    const exec = mockExecutor([{ id: 1 }])
    const db = createDatabase(exec)
    const result = await db.from<User>('user').any()
    expect(result).toBe(true)
  })

  it('retourne false si aucune ligne', async () => {
    const exec = mockExecutor([])
    const db = createDatabase(exec)
    const result = await db.from<User>('user').any()
    expect(result).toBe(false)
  })
})

describe('erreurs sans Executor', () => {
  it('toArray() sans Executor lève une erreur', async () => {
    await expect(from<User>('user').toArray()).rejects.toThrow('requires an Executor')
  })

  it('count() sans Executor lève une erreur', async () => {
    await expect(from<User>('user').count()).rejects.toThrow('requires an Executor')
  })
})
