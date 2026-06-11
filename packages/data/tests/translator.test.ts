import { describe, it, expect } from 'vitest'
import { from, insertInto, updateIn, deleteFrom } from '../src/queryable.js'

type User = { id: number; name: string; age: number; active: boolean; deletedAt: string | null; email: string }
type Post = { id: number; userId: number; title: string; published: boolean }

describe('SELECT — basique', () => {
  it('select *', () => {
    const { sql, params } = from<User>('user').toSql()
    expect(sql).toBe('SELECT * FROM user AS t0')
    expect(params).toEqual([])
  })

  it('filter >=', () => {
    const { sql, params } = from<User>('user').filter(u => u.age >= 18).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE (t0.age >= $1)')
    expect(params).toEqual([18])
  })

  it('NOT (unaire !)', () => {
    const { sql, params } = from<User>('user').filter(u => !u.active).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE NOT (t0.active)')
    expect(params).toEqual([])
  })

  it('deux filtres → AND implicite', () => {
    const { sql, params } = from<User>('user')
      .filter(u => u.age >= 18)
      .filter(u => u.active)
      .toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE (t0.age >= $1) AND t0.active')
    expect(params).toEqual([18])
  })

  it('OR dans un seul filtre', () => {
    const { sql, params } = from<User>('user').filter(u => u.age < 18 || u.active).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE ((t0.age < $1) OR t0.active)')
    expect(params).toEqual([18])
  })
})

describe('SELECT — NULL', () => {
  it('=== null → IS NULL', () => {
    const { sql, params } = from<User>('user').filter(u => u.deletedAt === null).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE t0.deletedAt IS NULL')
    expect(params).toEqual([])
  })

  it('!== null → IS NOT NULL', () => {
    const { sql, params } = from<User>('user').filter(u => u.deletedAt !== null).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE t0.deletedAt IS NOT NULL')
    expect(params).toEqual([])
  })
})

describe('SELECT — chaînes de méthodes', () => {
  it('includes → LIKE %..%', () => {
    const { sql, params } = from<User>('user').filter(u => u.email.includes('gmail')).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE t0.email LIKE $1')
    expect(params).toEqual(['%gmail%'])
  })

  it('startsWith → LIKE ..%', () => {
    const { sql, params } = from<User>('user').filter(u => u.name.startsWith('Kim')).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE t0.name LIKE $1')
    expect(params).toEqual(['Kim%'])
  })

  it('endsWith → LIKE %..', () => {
    const { sql, params } = from<User>('user').filter(u => u.name.endsWith('son')).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE t0.name LIKE $1')
    expect(params).toEqual(['%son'])
  })

  it('includes() échappe les wildcards SQL', () => {
    const { sql, params } = from<User>('user').filter(u => u.email.includes('a%_b')).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE t0.email LIKE $1')
    expect(params).toEqual(['%a\\%\\_b%'])
  })

  it('toLowerCase', () => {
    const { sql, params } = from<User>('user').filter((u: any) => u.name.toLowerCase() === 'kim').toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE (LOWER(t0.name) = $1)')
    expect(params).toEqual(['kim'])
  })

  it('trim → TRIM', () => {
    const { sql, params } = from<User>('user').filter((u: any) => u.name.trim() === 'kim').toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE (TRIM(t0.name) = $1)')
    expect(params).toEqual(['kim'])
  })

  it('replace → REPLACE', () => {
    const { sql, params } = from<User>('user').select((u: any) => ({ name: u.name.replace('a', 'b') })).toSql()
    expect(sql).toBe('SELECT REPLACE(t0.name, $1, $2) AS name FROM user AS t0')
    expect(params).toEqual(['a', 'b'])
  })

  it('length → LENGTH', () => {
    const { sql, params } = from<User>('user').filter((u: any) => u.name.length > 3).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE (LENGTH(t0.name) > $1)')
    expect(params).toEqual([3])
  })
})

describe('SELECT — projection', () => {
  it('select avec ObjectLiteralExpression', () => {
    const { sql, params } = from<User>('user')
      .select(u => ({ id: u.id, name: u.name }))
      .toSql()
    expect(sql).toBe('SELECT t0.id AS id, t0.name AS name FROM user AS t0')
    expect(params).toEqual([])
  })
})

describe('SELECT — modificateurs', () => {
  it('take → LIMIT', () => {
    const { sql } = from<User>('user').take(10).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 LIMIT 10')
  })

  it('skip → OFFSET', () => {
    const { sql } = from<User>('user').skip(20).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 OFFSET 20')
  })

  it('take + skip → LIMIT OFFSET', () => {
    const { sql } = from<User>('user').take(10).skip(20).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 LIMIT 10 OFFSET 20')
  })

  it('distinct', () => {
    const { sql } = from<User>('user').distinct().toSql()
    expect(sql).toBe('SELECT DISTINCT * FROM user AS t0')
  })

  it('orderBy ASC', () => {
    const { sql } = from<User>('user').orderBy(u => u.name).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 ORDER BY t0.name ASC')
  })

  it('orderByDesc DESC', () => {
    const { sql } = from<User>('user').orderByDesc(u => u.age).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 ORDER BY t0.age DESC')
  })

  it('groupBy', () => {
    const { sql } = from<User>('user').groupBy(u => u.active).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 GROUP BY t0.active')
  })

  it('having → HAVING', () => {
    const { sql, params } = from<User>('user')
      .groupBy(u => u.active)
      .having((u: any) => u.age > 18)
      .toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 GROUP BY t0.active HAVING (t0.age > $1)')
    expect(params).toEqual([18])
  })

  it('having avec agrégat', () => {
    const { sql, params } = from<User>('user')
      .groupBy(u => u.active)
      .having((u: any) => u.id.count() > 5)
      .toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 GROUP BY t0.active HAVING (COUNT(t0.id) > $1)')
    expect(params).toEqual([5])
  })
})

describe('SELECT — JOIN', () => {
  it('INNER JOIN', () => {
    const { sql, params } = from<User>('user')
      .join(from<Post>('post'), (u, p) => u.id === p.userId)
      .toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 INNER JOIN post AS t1 ON (t0.id = t1.userId)')
    expect(params).toEqual([])
  })

  it('LEFT JOIN', () => {
    const { sql } = from<User>('user')
      .leftJoin(from<Post>('post'), (u, p) => u.id === p.userId)
      .toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 LEFT JOIN post AS t1 ON (t0.id = t1.userId)')
  })

  it('JOIN + filtre multi-param', () => {
    const { sql, params } = from<User>('user')
      .join(from<Post>('post'), (u, p) => u.id === p.userId)
      .filter((u: any, p: any) => u.active && p.published)
      .toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 INNER JOIN post AS t1 ON (t0.id = t1.userId) WHERE (t0.active AND t1.published)')
    expect(params).toEqual([])
  })
})

describe('SELECT — IN', () => {
  it('[].includes(u.id) → IN ($1, $2, $3)', () => {
    const { sql, params } = from<User>('user').filter((u: any) => [1, 2, 3].includes(u.id)).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE t0.id IN ($1, $2, $3)')
    expect(params).toEqual([1, 2, 3])
  })

  it('[].includes() avec strings', () => {
    const { sql, params } = from<User>('user').filter((u: any) => ['a', 'b'].includes(u.name)).toSql()
    expect(sql).toBe('SELECT * FROM user AS t0 WHERE t0.name IN ($1, $2)')
    expect(params).toEqual(['a', 'b'])
  })
})

describe('UNION', () => {
  it('union basique', () => {
    const q1 = from<User>('user').filter(u => u.active)
    const q2 = from<User>('user').filter(u => !u.active)
    const { sql, params } = q1.union(q2).toSql()
    expect(sql).toBe('(SELECT * FROM user AS t0 WHERE t0.active) UNION (SELECT * FROM user AS t0 WHERE NOT (t0.active))')
    expect(params).toEqual([])
  })

  it('unionAll', () => {
    const q1 = from<User>('user').filter(u => u.active)
    const q2 = from<User>('user').filter(u => !u.active)
    const { sql } = q1.unionAll(q2).toSql()
    expect(sql).toContain('UNION ALL')
  })

  it('union avec paramètres réindexés', () => {
    const q1 = from<User>('user').filter(u => u.age >= 18)
    const q2 = from<User>('user').filter(u => u.age < 18)
    const { sql, params } = q1.union(q2).toSql()
    expect(sql).toBe('(SELECT * FROM user AS t0 WHERE (t0.age >= $1)) UNION (SELECT * FROM user AS t0 WHERE (t0.age < $2))')
    expect(params).toEqual([18, 18])
  })
})

describe('INSERT', () => {
  it('insert simple', () => {
    const { sql, params } = insertInto('user', { name: 'Kim', age: 30 })
    expect(sql).toBe('INSERT INTO user (name, age) VALUES ($1, $2)')
    expect(params).toEqual(['Kim', 30])
  })

  it('insert avec boolean', () => {
    const { sql, params } = insertInto('user', { name: 'Kim', active: true })
    expect(sql).toBe('INSERT INTO user (name, active) VALUES ($1, $2)')
    expect(params).toEqual(['Kim', true])
  })
})

describe('UPDATE', () => {
  it('update avec where', () => {
    const { sql, params } = updateIn<User>('user', { active: false }, u => u.id === 42)
    expect(sql).toBe('UPDATE user SET active = $1 WHERE (id = $2)')
    expect(params).toEqual([false, 42])
  })

  it('update sans where', () => {
    const { sql, params } = updateIn('user', { active: true })
    expect(sql).toBe('UPDATE user SET active = $1')
    expect(params).toEqual([true])
  })
})

describe('DELETE', () => {
  it('delete avec where', () => {
    const { sql, params } = deleteFrom<User>('user', u => u.id === 42)
    expect(sql).toBe('DELETE FROM user WHERE (id = $1)')
    expect(params).toEqual([42])
  })

  it('delete avec condition complexe', () => {
    const { sql, params } = deleteFrom<User>('user', u => u.active === false && u.deletedAt !== null)
    expect(sql).toBe('DELETE FROM user WHERE ((active = $1) AND deletedAt IS NOT NULL)')
    expect(params).toEqual([false])
  })
})
