# @gamn9/data

> Query builder SQL fluent et typé, construit sur `@gamn9/expression`.  
> Toutes les valeurs passent par des **paramètres préparés** — aucune concaténation SQL.

## Installation

```sh
npm install @gamn9/data
```

## Usage

### SELECT

```ts
import { from } from '@gamn9/data'

type User = { id: number; name: string; age: number; active: boolean; deletedAt: string | null }

const { sql, params } = from<User>('user')
  .filter(u => u.age >= 18 && u.active)
  .orderBy(u => u.name)
  .take(20)
  .skip(0)
  .toSql()

// sql    → "SELECT * FROM user AS t0 WHERE ((t0.age >= $1) AND t0.active) ORDER BY t0.name ASC LIMIT 20 OFFSET 0"
// params → [18]
```

### Projection

```ts
const { sql } = from<User>('user')
  .filter(u => u.active)
  .select(u => ({ id: u.id, name: u.name }))
  .toSql()

// sql → "SELECT t0.id AS id, t0.name AS name FROM user AS t0 WHERE t0.active"
```

### JOIN

```ts
type Post = { id: number; userId: number; title: string }

const { sql, params } = from<User>('user')
  .join(from<Post>('post'), (u, p) => u.id === p.userId)
  .filter((u: any, p: any) => u.active && p.published)
  .toSql()

// sql → "SELECT * FROM user AS t0 INNER JOIN post AS t1 ON (t0.id = t1.userId) WHERE (t0.active AND t1.published)"
```

### NULL

```ts
from<User>('user').filter(u => u.deletedAt === null).toSql()
// sql → "SELECT * FROM user AS t0 WHERE t0.deletedAt IS NULL"
// (=== null est toujours traduit en IS NULL, jamais en = NULL)
```

### Méthodes sur chaînes

```ts
from<User>('user').filter(u => u.name.startsWith('Kim')).toSql()
// sql    → "SELECT * FROM user AS t0 WHERE t0.name LIKE $1"
// params → ["Kim%"]
// (les wildcards SQL dans la valeur sont automatiquement échappés)
```

### INSERT

```ts
import { insertInto } from '@gamn9/data'

const { sql, params } = insertInto('user', { name: 'Kim', age: 30, active: true })
// sql    → "INSERT INTO user (name, age, active) VALUES ($1, $2, $3)"
// params → ["Kim", 30, true]
```

### UPDATE

```ts
import { updateIn } from '@gamn9/data'

const { sql, params } = updateIn<User>('user', { active: false }, u => u.id === 42)
// sql    → "UPDATE user SET active = $1 WHERE (id = $2)"
// params → [false, 42]
```

### DELETE

```ts
import { deleteFrom } from '@gamn9/data'

const { sql, params } = deleteFrom<User>('user', u => u.id === 42)
// sql    → "DELETE FROM user WHERE (id = $1)"
// params → [42]
```

## API

### `from<T>(table: string): Queryable<T>`

Point d'entrée pour construire un SELECT. Retourne un `Queryable<T>` immutable — chaque méthode retourne une nouvelle instance.

| Méthode | Description |
|---|---|
| `.filter(predicate)` | Ajoute une condition WHERE (plusieurs appels → AND implicite) |
| `.select(selector)` | Projection — le sélecteur doit retourner un objet littéral `{ ... }` |
| `.join(other, on)` | INNER JOIN |
| `.leftJoin(other, on)` | LEFT JOIN |
| `.groupBy(selector)` | GROUP BY |
| `.orderBy(selector)` | ORDER BY ASC |
| `.orderByDesc(selector)` | ORDER BY DESC |
| `.take(n)` | LIMIT |
| `.skip(n)` | OFFSET |
| `.distinct()` | SELECT DISTINCT |
| `.toSql()` | Génère `{ sql: string, params: unknown[] }` |

### `insertInto<T>(table, record): SqlResult`

Génère un INSERT pour un objet plain. Toutes les valeurs passent en paramètres préparés.

### `updateIn<T>(table, record, where?): SqlResult`

Génère un UPDATE. Le `where` est optionnel (UPDATE sans WHERE si omis).

### `deleteFrom<T>(table, where): SqlResult`

Génère un DELETE. Le `where` est obligatoire.

## Méthodes supportées dans les lambdas

| Méthode JS | SQL généré |
|---|---|
| `.includes(s)` | `col LIKE $n` avec `%s%` |
| `.startsWith(s)` | `col LIKE $n` avec `s%` |
| `.endsWith(s)` | `col LIKE $n` avec `%s` |
| `.toLowerCase()` | `LOWER(col)` |
| `.toUpperCase()` | `UPPER(col)` |
| `.count()` | `COUNT(col)` |
| `.min()` / `.max()` / `.avg()` / `.sum()` | `MIN(col)` / … |

## Notes

- Les paramètres préparés utilisent la notation `$1`, `$2`, … (PostgreSQL / SQLite). Pour MySQL (`?`), sous-classer `SqlTranslator` et surcharger `addParam`.
- `@gamn9/data` ne fournit pas de couche d'exécution — passer `{ sql, params }` directement au driver de ton choix (`pg`, `better-sqlite3`, `mysql2`, etc.).

## Licence

MIT
