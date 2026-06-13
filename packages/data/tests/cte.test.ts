import { describe, it, expect } from 'vitest'
import { from } from '../src/queryable.js'
import { postgres, mysql } from '../src/sql/dialect.js'

type User   = { id: number; name: string; age: number; managerId: number | null }
type Metric = { userId: number; value: number }

describe('CTE — WITH basique', () => {
  it('CTE simple référencée comme source principale', () => {
    const adultes = from<User>('user').filter(u => u.age >= 18)
    const { sql, params } = from<User>('adultes')
      .withCte('adultes', adultes)
      .toSql({ dialect: postgres })

    expect(sql).toMatch(/^WITH adultes AS \(SELECT \* FROM user AS t0 WHERE/)
    expect(sql).toContain('SELECT * FROM adultes AS t0')
    expect(params).toEqual([18])
  })

  it('les params de la CTE précèdent ceux du SELECT principal', () => {
    const top = from<Metric>('metric').filter((m: any) => m.value > 100)
    const { sql, params } = from<Metric>('top_metrics')
      .withCte('top_metrics', top)
      .filter((m: any) => m.userId === 5)
      .toSql({ dialect: postgres })

    // value > 100 est dans la CTE → $1=100 ; userId = 5 est dans le SELECT → $2=5
    expect(params).toEqual([100, 5])
    expect(sql).toContain('$1')
    expect(sql).toContain('$2')
  })

  it('mysql : CTE avec placeholders ?', () => {
    const adultes = from<User>('user').filter(u => u.age >= 18)
    const { sql, params } = from<User>('adultes')
      .withCte('adultes', adultes)
      .toSql({ dialect: mysql })

    expect(sql).toMatch(/^WITH adultes AS \(/)
    expect(sql).toContain('SELECT * FROM adultes AS t0')
    const questionMarks = (sql.match(/\?/g) ?? []).length
    expect(questionMarks).toBe(1)
    expect(params).toEqual([18])
  })

  it('plusieurs CTE', () => {
    const adultes = from<User>('user').filter(u => u.age >= 18)
    const metrics = from<Metric>('metric').filter((m: any) => m.value > 50)
    const { sql, params } = from<User>('adultes')
      .withCte('adultes', adultes)
      .withCte('top_metrics', metrics)
      .toSql({ dialect: postgres })

    expect(sql).toMatch(/^WITH adultes AS .+, top_metrics AS/)
    expect(params).toEqual([18, 50])
  })
})

describe('CTE — WITH RECURSIVE', () => {
  it('WITH RECURSIVE quand recursive: true', () => {
    // CTE récursive type : organigramme
    const baseCase = from<User>('user').filter((u: any) => u.managerId === null)
    const { sql } = from<User>('org')
      .withCte('org', baseCase, { recursive: true })
      .toSql({ dialect: postgres })

    expect(sql).toMatch(/^WITH RECURSIVE org AS/)
  })

  it('WITH (non récursif) quand aucun recursive: true', () => {
    const adultes = from<User>('user').filter(u => u.age >= 18)
    const { sql } = from<User>('adultes')
      .withCte('adultes', adultes)
      .toSql({ dialect: postgres })

    expect(sql).not.toContain('RECURSIVE')
  })
})

describe('CTE — intégration avec autres clauses', () => {
  it('CTE + filter + orderBy sur la requête principale', () => {
    const cteQ = from<User>('user').filter(u => u.age >= 18)
    const { sql, params } = from<User>('adultes')
      .withCte('adultes', cteQ)
      .filter(u => u.age <= 65)
      .orderBy(u => u.name)
      .toSql({ dialect: postgres })

    expect(sql).toContain('WITH adultes AS')
    expect(sql).toContain('WHERE (t0.age <= $2)')
    expect(sql).toContain('ORDER BY t0.name ASC')
    expect(params).toEqual([18, 65])
  })

  it('CTE dont la query est un UNION', () => {
    const q1 = from<User>('user').filter(u => u.age < 18)
    const q2 = from<User>('admin').filter(u => u.age < 18)
    const { sql, params } = from<User>('mineurs')
      .withCte('mineurs', q1.union(q2))
      .toSql({ dialect: postgres })

    expect(sql).toMatch(/^WITH mineurs AS \(\(SELECT/)
    expect(sql).toContain('UNION')
    expect(params).toEqual([18, 18])
  })
})
