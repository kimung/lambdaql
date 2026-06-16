# @lambdaql/mikro-orm

[MikroORM](https://mikro-orm.io/) QueryBuilder integration for [@lambdaql/data](../data).

## Installation

```sh
npm install @lambdaql/mikro-orm @lambdaql/data
```

`@mikro-orm/core` is a peer dependency.

## Usage

```ts
import { applyQueryable } from "@lambdaql/mikro-orm";
import { from } from "@lambdaql/data";

const query = from<User>("user")
  .filter((u) => u.active && u.age >= 18)
  .orderBy((u) => u.name)
  .take(20);

const qb = em.createQueryBuilder(User);
applyQueryable(qb, query);
const users = await qb.getResult();
```

## Options

```ts
applyQueryable(qb, query, {
  // Override the entity metadata used for auto-join and naming
  entityMeta: orm.getMetadata().get("User"),
  // Alias overrides for joined relations ({ [relationName]: qbAlias })
  aliasOverrides: { company: "c" },
});
```

## Auto-join

Navigation chains in lambdas are automatically joined via `leftJoin`:

```ts
from<User>("user").filter((u) => u.company.country.name === "FR");
// → LEFT JOIN company ON ... LEFT JOIN country ON ...
```

Requires MikroORM entity metadata to be available (i.e. `orm.getMetadata()`).

## Naming strategy

Column names are derived from MikroORM's own naming strategy, with priority given to explicit `@Property({ fieldName })` overrides:

```ts
import { createNamingFromMikroOrm } from "@lambdaql/mikro-orm";

const naming = createNamingFromMikroOrm(orm, userMeta);
applyQueryable(qb, query, { naming });
```

## Parameters

MikroORM QueryBuilder uses positional `?` placeholders. `@lambdaql/mikro-orm` translates the `$1`/`$2` placeholders from `@lambdaql/data` automatically.

## Limitations

- **UNION** is not supported — use the MikroORM QueryBuilder directly for union queries.
- **CTE (WITH)** is not supported.
- LIKE arguments must be string constants (use the [@lambdaql/compiler](../compiler) AOT transformer for closure values).
