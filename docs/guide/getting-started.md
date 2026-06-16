# Getting Started

## Installation

Install the core package and the driver for your database:

::: code-group

```sh [PostgreSQL]
npm install @lambdaql/data @lambdaql/pg
```

```sh [SQLite]
npm install @lambdaql/data @lambdaql/sqlite
```

:::

## Quick start

### 1. Create a database handle

::: code-group

```ts [PostgreSQL]
import { Pool } from "pg";
import { createPgExecutor } from "@lambdaql/pg";
import { createDatabase } from "@lambdaql/data";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = createDatabase(createPgExecutor(pool));
```

```ts [SQLite]
import Database from "better-sqlite3";
import { createSqliteExecutor } from "@lambdaql/sqlite";
import { createDatabase } from "@lambdaql/data";

const sqlite = new Database("myapp.db");
const db = createDatabase(createSqliteExecutor(sqlite));
```

:::

### 2. Define your entity types

```ts
type User = {
  id: number;
  name: string;
  age: number;
  active: boolean;
};
```

### 3. Query

```ts
// SELECT * FROM users WHERE age > $1 ORDER BY name ASC
const users = await db
  .from<User>("users")
  .filter((u) => u.age > 18)
  .orderBy((u) => u.name)
  .toArray();

// SELECT name, age FROM users WHERE active = $1 LIMIT 10
const preview = await db
  .from<User>("users")
  .filter((u) => u.active === true)
  .select((u) => ({ name: u.name, age: u.age }))
  .take(10)
  .toArray();
```

## Naming strategies

When your TypeScript property names differ from the database column names, pass a naming strategy:

```ts
import { createDatabase, snakeCaseNaming } from "@lambdaql/data";

// camelCase → snake_case: departmentId → department_id
const db = createDatabase(executor, { naming: snakeCaseNaming });
```

`snakeCaseNaming` is built-in. You can also supply any `(property: string) => string` function.

## Transactions

```ts
await db.transaction(async (tx) => {
  await tx.insertInto("users", { name: "Alice", age: 30, active: true });
  await tx.updateIn("users", { active: false }, (u) => u.name === "Bob");
});
```

## Next steps

- [Queryable&lt;T&gt; API](/api/queryable) — full method reference
- [DML helpers](/api/dml) — `insertInto`, `updateIn`, `deleteFrom`
- [AOT Compiler](/guide/aot-compiler) — eliminate runtime lambda parsing
