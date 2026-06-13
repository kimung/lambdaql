import { describe, it, expect } from 'vitest'
import { from, insertInto, updateIn, deleteFrom } from '../src/queryable.js'
import { postgres, mysql, sqlite } from '../src/sql/dialect.js'

type User = { id: number; name: string; age: number; active: boolean }
type Order = { id: number; userId: number; total: number }

describe('Dialect — placeholders', () => {
  it('postgres → $1, $2', () => {
    const { sql, params } = from<User>('user')
      .filter(u => u.age > 18)
      .filter(u => u.active)
      .toSql({ dialect: postgres })
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE (t0.age > $1) AND t0.active')
    expect(params).toEqual([18])
  })

  it('mysql → ?, ?', () => {
    const { sql, params } = from<User>('user')
      .filter(u => u.age > 18)
      .filter(u => u.active)
      .toSql({ dialect: mysql })
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE (t0.age > ?) AND t0.active')
    expect(params).toEqual([18])
  })

  it('sqlite → ?, ?', () => {
    const { sql, params } = from<User>('user')
      .filter(u => u.age > 18)
      .toSql({ dialect: sqlite })
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE (t0.age > ?)')
    expect(params).toEqual([18])
  })
})

describe('Dialect — LIMIT / OFFSET', () => {
  it('postgres — LIMIT seul', () => {
    const { sql } = from<User>('user').take(10).toSql({ dialect: postgres })
    expect(sql).toContain('LIMIT 10')
    expect(sql).not.toContain('OFFSET')
  })

  it('postgres — OFFSET seul', () => {
    const { sql } = from<User>('user').skip(5).toSql({ dialect: postgres })
    expect(sql).toContain('OFFSET 5')
    expect(sql).not.toContain('LIMIT')
  })

  it('mysql — OFFSET seul → LIMIT 18446744073709551615 OFFSET n', () => {
    const { sql } = from<User>('user').skip(5).toSql({ dialect: mysql })
    expect(sql).toContain('LIMIT 18446744073709551615 OFFSET 5')
  })

  it('mysql — LIMIT + OFFSET', () => {
    const { sql } = from<User>('user').take(10).skip(20).toSql({ dialect: mysql })
    expect(sql).toContain('LIMIT 10 OFFSET 20')
  })

  it('sqlite — OFFSET seul → LIMIT -1 OFFSET n', () => {
    const { sql } = from<User>('user').skip(5).toSql({ dialect: sqlite })
    expect(sql).toContain('LIMIT -1 OFFSET 5')
  })

  it('sqlite — LIMIT + OFFSET', () => {
    const { sql } = from<User>('user').take(10).skip(20).toSql({ dialect: sqlite })
    expect(sql).toContain('LIMIT 10 OFFSET 20')
  })
})

describe('Dialect — UNION avec réindexage', () => {
  it('postgres : les params de la seconde branche sont réindexés', () => {
    const q1 = from<User>('user').filter(u => u.age > 18)
    const q2 = from<User>('admin').filter(u => u.age > 21)
    const { sql, params } = q1.union(q2).toSql({ dialect: postgres })
    expect(sql).toContain('$1')
    expect(sql).toContain('$2')
    expect(params).toEqual([18, 21])
  })

  it('mysql : pas de réindexage (tous les placeholders sont ?)', () => {
    const q1 = from<User>('user').filter(u => u.age > 18)
    const q2 = from<User>('admin').filter(u => u.age > 21)
    const { sql, params } = q1.union(q2).toSql({ dialect: mysql })
    const questionMarks = (sql.match(/\?/g) ?? []).length
    expect(questionMarks).toBe(2)
    expect(params).toEqual([18, 21])
  })
})

describe('Dialect — sous-requêtes avec réindexage', () => {
  it('postgres : params de la sous-requête réindexés', () => {
    const inner = from<Order>('orders').filter((o: any) => o.total > 100).select((o: any) => ({ userId: o.userId }))
    const { sql, params } = from<User>('user')
      .filter(u => u.age > 18)
      .whereIn((u: any) => u.id, inner)
      .toSql({ dialect: postgres })
    expect(params).toEqual([18, 100])
    expect(sql).toContain('$1')
    expect(sql).toContain('$2')
  })

  it('mysql : sous-requête avec ? dans le bon ordre', () => {
    const inner = from<Order>('orders').filter((o: any) => o.total > 100).select((o: any) => ({ userId: o.userId }))
    const { sql, params } = from<User>('user')
      .filter(u => u.age > 18)
      .whereIn((u: any) => u.id, inner)
      .toSql({ dialect: mysql })
    const questionMarks = (sql.match(/\?/g) ?? []).length
    expect(questionMarks).toBe(2)
    expect(params).toEqual([18, 100])
  })
})

describe('Dialect — DML', () => {
  it('insertInto avec mysql → ?', () => {
    const { sql, params } = insertInto('user', { name: 'Alice', age: 30 }, { dialect: mysql })
    expect(sql).toBe('INSERT INTO user (name, age) VALUES (?, ?)')
    expect(params).toEqual(['Alice', 30])
  })

  it('updateIn avec mysql → ?', () => {
    const { sql, params } = updateIn<User>('user', { name: 'Bob' }, (u: any) => u.id === 1, { dialect: mysql })
    expect(sql).toBe('UPDATE user SET name = ? WHERE (id = ?)')
    expect(params).toEqual(['Bob', 1])
  })

  it('deleteFrom avec mysql → ?', () => {
    const { sql, params } = deleteFrom<User>('user', (u: any) => u.id === 5, { dialect: mysql })
    expect(sql).toBe('DELETE FROM user WHERE (id = ?)')
    expect(params).toEqual([5])
  })
})

describe('Dialect — fonctions SQL portables', () => {
  it('MOD via %', () => {
    const { sql, params } = from<User>('user').select((u: any) => ({ r: u.age % 2 })).toSql({ dialect: mysql })
    expect(sql).toContain('MOD(t0.age, ?)')
    expect(params).toEqual([2])
  })

  it('COALESCE via ??', () => {
    const { sql } = from<User>('user').select((u: any) => ({ n: u.name ?? 'anon' })).toSql({ dialect: mysql })
    expect(sql).toContain('COALESCE(t0.name, ?)')
  })

  it('LENGTH via .length', () => {
    const { sql } = from<User>('user').filter((u: any) => u.name.length > 3).toSql({ dialect: mysql })
    expect(sql).toContain('LENGTH(t0.name)')
  })
})
