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

## Complete example — Repository pattern

`@lambdaql/mikro-orm` exports `LambdaRepository<T>`, an abstract base class that eliminates the boilerplate. Extend it instead of `EntityRepository<T>`:

```ts
import { LambdaRepository } from "@lambdaql/mikro-orm";
import { Entity, PrimaryKey, Property, ManyToOne, EntityRepository } from "@mikro-orm/core";

@Entity()
class Company {
  @PrimaryKey() id!: number;
  @Property() name!: string;
}

@Entity()
class User {
  @PrimaryKey() id!: number;
  @Property() name!: string;
  @Property() age!: number;
  @Property() active!: boolean;
  @ManyToOne(() => Company) company!: Company;
}

@Repository(User)
export class UserRepository extends LambdaRepository<User> {
  // No boilerplate — findWhere and queryable are inherited.

  // Add domain methods on top:
  findAdults() {
    return this.findWhere((u) => u.age >= 18);
  }
}
```

### Usage

```ts
const repo = em.getRepository(UserRepository);

// Simple predicate
const adults = await repo.findWhere((u) => u.age >= 18);

// With ordering and pagination via the optional build callback
const page = await repo.findWhere(
  (u) => u.active === true,
  (q) =>
    q
      .orderBy((u) => u.name)
      .skip(20)
      .take(10),
);

// Navigation chain — auto-join on company (requires em + entity)
const acmeUsers = await repo.findWhere((u) => u.company.name === "ACME");
// → LEFT JOIN company t1 ON t0.company_id = t1.id
//   WHERE t1.name = ?
```

For queries that go beyond a single predicate (unions of conditions, `select`, `groupBy`), compose a full `Queryable<T>` from `this.queryable` and pass it to `applyQueryable` directly:

```ts
export class UserRepository extends LambdaRepository<User> {
  async report() {
    const q = this.queryable
      .filter((u) => u.active === true)
      .groupBy((u) => u.company.name)
      .select((u) => ({ company: u.company.name }));

    const qb = (this.em as any).createQueryBuilder(User, "t0");
    applyQueryable(qb, q, { em: this.em, entity: User });
    return qb.getRawMany();
  }
}
```

::: tip AOT compiler
Navigation chains and parameter destructuring (`u => u.company.name === "ACME"`) work at runtime. To use `({ company: { name } }) => name === "ACME"`, enable the [AOT compiler](/guide/aot-compiler#destructured-parameters).
:::

## Limitations

- `UNION` / `unionAll` are not supported — use the MikroORM QueryBuilder directly in those cases.
- Parameterised values use `?` placeholders (MikroORM QB format), not `$1`.
