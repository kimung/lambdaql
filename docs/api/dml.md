# DML Helpers

LambdaQL provides typed helpers for `INSERT`, `UPDATE`, and `DELETE`. They can be used standalone (returning `SqlResult`) or through a `Database` handle (executing directly).

## Via `Database`

```ts
const db = createDatabase(executor, { naming: snakeCaseNaming });

// INSERT
await db.insertInto("users", { name: "Alice", age: 30, active: true });

// UPDATE
await db.updateIn("users", { active: false }, (u) => u.id === 42);

// DELETE
await db.deleteFrom("users", (u) => u.active === false);
```

## Standalone (SQL generation only)

Import the functions directly from `@lambdaql/data`:

```ts
import { insertInto, updateIn, deleteFrom } from "@lambdaql/data";
```

### `insertInto(table, record, options?)`

```ts
const { sql, params } = insertInto("users", { name: "Alice", age: 30 });
// sql:    "INSERT INTO users (name, age) VALUES ($1, $2)"
// params: ["Alice", 30]
```

With snake_case naming:

```ts
const { sql, params } = insertInto("users", { firstName: "Alice", departmentId: 1 }, { naming: snakeCaseNaming });
// INSERT INTO users (first_name, department_id) VALUES ($1, $2)
```

### `updateIn(table, record, where?, options?)`

```ts
const { sql, params } = updateIn("users", { active: false }, (u) => u.id === 42);
// sql:    "UPDATE users SET active = $1 WHERE id = $2"
// params: [false, 42]
```

Omit `where` to update all rows.

### `deleteFrom(table, where, options?)`

```ts
const { sql, params } = deleteFrom("users", (u) => u.active === false);
// sql:    "DELETE FROM users WHERE active = $1"
// params: [false]
```

## Options

All three functions accept the same optional `options` object:

| Option    | Type             | Description                                                |
| --------- | ---------------- | ---------------------------------------------------------- |
| `naming`  | `NamingStrategy` | Maps object keys to column names                           |
| `dialect` | `Dialect`        | `postgres` (default, `$1` params) or `sqlite` (`?` params) |

## Transactions

Wrap multiple operations in a single transaction:

```ts
await db.transaction(async (tx) => {
  await tx.insertInto("orders", { userId: 1, total: 299.99 });
  await tx.updateIn("users", { balance: newBalance }, (u) => u.id === 1);
});
// Automatically rolls back on error
```
