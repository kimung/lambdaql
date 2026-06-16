# PostgreSQL

Integration with [node-postgres](https://node-postgres.com/) (`pg`).

## Install

```sh
npm install @lambdaql/data @lambdaql/pg pg
npm install --save-dev @types/pg
```

## Usage

```ts
import { Pool } from "pg";
import { createPgExecutor } from "@lambdaql/pg";
import { createDatabase } from "@lambdaql/data";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = createDatabase(createPgExecutor(pool));
```

`createPgExecutor` returns a `TransactionalExecutor` that:

- Uses `$1`, `$2`, … placeholders (PostgreSQL native parameterised queries)
- Acquires a `PoolClient` for transactions and releases it after `COMMIT` or `ROLLBACK`

## Transactions

```ts
await db.transaction(async (tx) => {
  await tx.insertInto("users", { name: "Alice" });
  const count = await tx.from<User>("users").count();
  console.log(count); // inside the same transaction
});
// COMMIT on success, ROLLBACK on throw
```

## Dialect

PostgreSQL is the default dialect. You don't need to pass it explicitly, but you can:

```ts
import { postgres } from "@lambdaql/data";

const { sql } = q.toSql({ dialect: postgres });
// placeholders: $1, $2, …
```
