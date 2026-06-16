# SQLite

Integration with [better-sqlite3](https://github.com/WiseLibs/better-sqlite3).

## Install

```sh
npm install @lambdaql/data @lambdaql/sqlite better-sqlite3
npm install --save-dev @types/better-sqlite3
```

## Usage

```ts
import Database from "better-sqlite3";
import { createSqliteExecutor } from "@lambdaql/sqlite";
import { createDatabase, snakeCaseNaming, sqlite } from "@lambdaql/data";

const rawDb = new Database("myapp.db");
const db = createDatabase(createSqliteExecutor(rawDb), { naming: snakeCaseNaming });
```

`createSqliteExecutor` wraps `better-sqlite3` in LambdaQL's `TransactionalExecutor` interface. Because `better-sqlite3` is synchronous, all operations are wrapped in `Promise.resolve()` internally.

## Transactions

```ts
await db.transaction(async (tx) => {
  await tx.insertInto("users", { name: "Alice" });
  await tx.updateIn("users", { active: false }, (u) => u.id === 1);
});
// Uses BEGIN / COMMIT / ROLLBACK on the underlying sqlite3 database
```

## Dialect

Pass the `sqlite` dialect when generating SQL without an executor:

```ts
import { sqlite } from "@lambdaql/data";
import { from } from "@lambdaql/data";

const { sql, params } = from<User>("users")
  .filter((u) => u.active === true)
  .toSql({ dialect: sqlite });
// placeholders: ?, ?, … (SQLite style)
```

## In-memory databases

```ts
const db = new Database(":memory:");
```

Useful for tests — each test gets a fresh in-memory database with no setup cost.
