# Queryable&lt;T&gt;

`Queryable<T>` is the central query-building type. Every method returns a new `Queryable` — the builder is fully immutable.

## Creating a query

```ts
import { from } from "@lambdaql/data";

// standalone (generates SQL only, no executor)
const q = from<User>("users");

// with an executor (enables toArray / first / count / …)
const db = createDatabase(executor);
const q = db.from<User>("users");
```

## Filtering

### `.filter(predicate)`

Adds a `WHERE` clause. Multiple calls are combined with `AND`.

```ts
db.from<User>("users")
  .filter((u) => u.active === true)
  .filter((u) => u.age > 18);
// WHERE active = $1 AND age > $2
```

Supported operators: `===`, `!==`, `==`, `!=`, `>`, `>=`, `<`, `<=`, `&&`, `||`, `!`, `??`.

**Null checks:**

```ts
.filter((u) => u.deletedAt === null)   // IS NULL
.filter((u) => u.deletedAt !== null)   // IS NOT NULL
```

**String matching:**

```ts
.filter((u) => u.name.startsWith("Al"))  // LIKE 'Al%'
.filter((u) => u.name.endsWith("ce"))    // LIKE '%ce'
.filter((u) => u.name.includes("lic"))   // LIKE '%lic%'
```

### `.whereRaw(sql, ...params)`

Inject raw SQL for cases not covered by the lambda API:

```ts
.whereRaw("age BETWEEN $1 AND $2", 20, 30)
```

### `.whereIn(selector, subquery)`

```ts
const activeIds = db
  .from<Session>("sessions")
  .filter((s) => s.active === true)
  .select((s) => s.userId);

db.from<User>("users").whereIn((u) => u.id, activeIds);
// WHERE id IN (SELECT user_id FROM sessions WHERE active = $1)
```

### `.whereNotIn(selector, subquery)`

Inverse of `whereIn`.

### `.whereExists(subquery)` / `.whereNotExists(subquery)`

```ts
db.from<User>("users").whereExists(db.from<Order>("orders").filter((o) => o.userId === u.id));
// WHERE EXISTS (SELECT * FROM orders WHERE user_id = $1)
```

## Projection

### `.select(selector)`

```ts
// scalar
.select((u) => u.name)                     // SELECT name

// object
.select((u) => ({ id: u.id, name: u.name }))  // SELECT id, name
```

## Joins

### `.join(alias, other, on)`

Inner join. `alias` is a TypeScript-only hint for the merged type shape.

```ts
type UserWithDept = User & { dept: Department };

db.from<User>("users")
  .join<"dept", Department>("dept", db.from("departments"), (u, d) => u.departmentId === d.id)
  .select((u: UserWithDept) => ({ name: u.name, dept: u.dept.name }));
// INNER JOIN departments t1 ON t0.department_id = t1.id
```

### `.leftJoin(alias, other, on)`

Left outer join — joined columns become `Partial`.

## Sorting

### `.orderBy(selector)` / `.orderByDesc(selector)`

```ts
.orderBy((u) => u.name)       // ORDER BY name ASC
.orderByDesc((u) => u.salary) // ORDER BY salary DESC
```

### `.orderByRaw(sql, ...params)`

```ts
.orderByRaw("LOWER(name) ASC")
```

## Grouping

### `.groupBy(selector)`

```ts
db.from<Order>("orders")
  .groupBy((o) => o.status)
  .select((o) => ({ status: o.status }));
// GROUP BY status
```

### `.having(predicate)` / `.havingRaw(sql, ...params)`

```ts
.groupBy((o) => o.userId)
.having((o) => o.total > 1000)
// HAVING total > $1
```

## Pagination

### `.take(n)` / `.skip(n)`

```ts
.skip(20).take(10)   // LIMIT 10 OFFSET 20
```

## Deduplication

### `.distinct()`

```ts
.distinct()   // SELECT DISTINCT …
```

## Set operations

### `.union(other)` / `.unionAll(other)`

```ts
const q = db.from<User>("active_users").union(db.from<User>("archived_users"));
// (SELECT …) UNION (SELECT …)
```

## CTEs

### `.withCte(name, query, opts?)`

```ts
const recent = db.from<Order>("orders").filter((o) => o.createdAt > cutoff);

db.from<Order>("recent")
  .withCte("recent", recent)
  .filter((o) => o.total > 500);
// WITH recent AS (SELECT * FROM orders WHERE …) SELECT * FROM recent WHERE …
```

Pass `{ recursive: true }` for recursive CTEs.

## Execution

All execution methods require a database handle created with `createDatabase()`.

| Method              | Returns                   | SQL                                |
| ------------------- | ------------------------- | ---------------------------------- |
| `.toArray()`        | `Promise<T[]>`            | Fetches all rows                   |
| `.first()`          | `Promise<T>`              | Fetches first row, throws if empty |
| `.firstOrDefault()` | `Promise<T \| undefined>` | Fetches first row or `undefined`   |
| `.count()`          | `Promise<number>`         | `SELECT COUNT(*) FROM (…) AS sub`  |
| `.any()`            | `Promise<boolean>`        | `true` if at least one row exists  |

## `toSql(options?)`

Generates SQL without executing. Useful for debugging or passing to a raw driver.

```ts
const { sql, params } = db
  .from<User>("users")
  .filter((u) => u.age > 18)
  .toSql();
// sql:    "SELECT * FROM users WHERE age > $1"
// params: [18]
```

Options:

| Option    | Type             | Description                        |
| --------- | ---------------- | ---------------------------------- |
| `naming`  | `NamingStrategy` | Override property → column mapping |
| `dialect` | `Dialect`        | `postgres` (default) or `sqlite`   |
