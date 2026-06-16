# MikroORM

`@lambdaql/mikro-orm` integrates `Queryable<T>` with the MikroORM `QueryBuilder`.

## Install

```sh
npm install @lambdaql/data @lambdaql/mikro-orm @mikro-orm/core
```

## `applyQueryable`

Applies a `Queryable<T>` to an existing MikroORM `QueryBuilder`:

```ts
import { applyQueryable } from "@lambdaql/mikro-orm";
import { from } from "@lambdaql/data";

const qb = em.createQueryBuilder(User, "u");

const query = from<User>("u")
  .filter((u) => u.age > 18)
  .orderByDesc((u) => u.salary);

applyQueryable(qb, query, { em, entity: User });

const users = await qb.getResultList();
```

### Options

| Option    | Type                     | Description                                                   |
| --------- | ------------------------ | ------------------------------------------------------------- |
| `naming`  | `NamingStrategy`         | Property → column mapping                                     |
| `aliases` | `Record<string, string>` | Override QB aliases                                           |
| `em`      | `EntityManager`          | Used to derive naming from MikroORM metadata                  |
| `entity`  | `EntityName<T>`          | Entity class (used with `em` to read `fieldName` annotations) |

When `em` and `entity` are provided, `applyQueryable` reads `@Property({ fieldName })` annotations and the MikroORM naming strategy automatically — no manual `naming` option needed.

## `createNamingFromMikroOrm`

Derives a `NamingStrategy` from MikroORM's own naming strategy:

```ts
import { createNamingFromMikroOrm } from "@lambdaql/mikro-orm";
import { from } from "@lambdaql/data";

const naming = createNamingFromMikroOrm(orm, em.getMetadata().get(User));

const { sql, params } = from<User>("users")
  .filter((u) => u.firstName === "Alice")
  .toSql({ naming });
// WHERE first_name = $1
```

`fieldName` annotations on `@Property()` take priority over the MikroORM naming strategy.

## Auto-join

`applyQueryable` detects navigation chains in lambdas (e.g. `u.company.country.name`) and automatically calls `qb.leftJoin()` for each relation segment found in MikroORM's metadata:

```ts
const query = from<User>("u").filter((u) => u.company.country.name === "France");
applyQueryable(qb, query, { em, entity: User });
// Automatically adds: LEFT JOIN company … LEFT JOIN country …
```

Requires `em` + `entity` so metadata is available.

## Limitations

- `UNION` / `unionAll` are not supported — use the MikroORM QueryBuilder directly in those cases.
- Parameterised values use `?` placeholders (MikroORM QB format), not `$1`.
