# AOT Compiler

By default, LambdaQL parses lambda expressions at runtime using `fn.toString()`. The AOT (Ahead-of-Time) compiler replaces that with a TypeScript custom transformer that converts lambdas to pre-built AST nodes at compile time — zero parsing cost at runtime.

## How it works

**Without AOT** — every call to `.filter()`, `.select()`, etc. calls `fn.toString()` → Lexer → Parser:

```ts
.filter((u) => u.age > 18)   // parsed at runtime on every call
```

**With AOT** — the transformer rewrites the source before TypeScript emits JavaScript:

```ts
// what you write:
.filter((u) => u.age > 18)

// what gets compiled to JS:
.filter({ kind: "BinaryExpression", operator: ">", ... })
```

The result is identical SQL. The difference is measurable for queries executed in tight loops.

Runtime parsing is the **default** and is production-ready for plain lambdas. The AOT compiler is **recommended** for production because it removes the per-call parsing cost and unlocks two features that runtime parsing cannot support: [closure capture](#closure-capture) and [destructured parameters](#destructured-parameters).

## Setup options

Choose the approach that fits your build tool:

- **[`@lambdaql/compiler`](#ts-patch)** — TypeScript custom transformer (works everywhere `tsc` runs)
- **[`@lambdaql/unplugin`](/integrations/unplugin)** — Vite, esbuild, Rollup, or webpack plugin

## ts-patch transformer {#ts-patch}

### Install

```sh
npm install --save-dev @lambdaql/compiler ts-patch
```

### Patch TypeScript

```sh
npx ts-patch install
```

This patches the local `typescript` binary once. Re-run it after upgrading TypeScript.

### Configure `tsconfig.json`

```json
{
  "compilerOptions": {
    "plugins": [{ "transform": "@lambdaql/compiler" }]
  }
}
```

### Compile

```sh
tsc          # or ts-node, ts-jest, etc.
```

The transformer runs automatically as part of `tsc`.

## Closure capture

Outer variables referenced inside a lambda are captured as live references:

```ts
const minAge = 18;
const users = await db.from<User>("users").filter((u) => u.age > minAge); // minAge captured as ConstantExpression { value: minAge }
```

The compiled output keeps the reference alive — `minAge` is not inlined to `18` at compile time, so the query reflects the runtime value.

## Destructured parameters {#destructured-parameters}

Object destructuring in lambda parameters is supported **only with the AOT compiler**:

```ts
.filter(({ age, name }) => age > 18 && name === "Kim")
// → WHERE age > $1 AND name = $2
```

Renaming and nested destructuring also work — a nested pattern navigates relations the same way a property chain does:

```ts
.filter(({ age: minAge }) => minAge > 18)            // → age column
.filter(({ company: { name } }) => name === "ACME")  // → joins through company
```

**Not supported** (throws at compile time): default values (`{ age = 18 }`), rest elements (`{ ...rest }`), and array destructuring (`([a, b]) => …`).

Without the AOT compiler, any destructured parameter throws at runtime with a message pointing here — use a plain parameter (`(u) => u.age > 18`) or enable the transformer.

## Supported lambda parameter forms

| Form                                  | Runtime (`fn.toString()`) | AOT compiler |
| ------------------------------------- | :-----------------------: | :----------: |
| Plain parameter — `(u) => u.age`      |            ✅             |      ✅      |
| Closure capture — `u => u.age > x`    |            ❌             |      ✅      |
| Destructuring — `({ age }) => age`    |            ❌             |      ✅      |
| Renamed / nested — `({ a: b })`       |            ❌             |      ✅      |
| Defaults / rest / array destructuring |            ❌             |      ❌      |

## Fallback

When the AOT compiler is not active (e.g. during tests with `ts-jest` and no transformer configured), LambdaQL falls back to runtime parsing automatically. Plain lambdas work as usual; closures and destructured parameters are not available in this mode. A one-time warning is logged in development:

```
[lambdaql] AOT compiler inactive: lambda closures and parameter destructuring are not supported in runtime mode.
Configure @lambdaql/compiler (ts-patch transformer) to enable them.
```

Silence it by setting `NODE_ENV=production` or `NODE_ENV=test`.
