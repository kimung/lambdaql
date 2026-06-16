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

## Fallback

When the AOT compiler is not active (e.g. during tests with `ts-jest` and no transformer configured), LambdaQL falls back to runtime parsing automatically and logs a one-time warning in development:

```
[gamn9] AOT compiler inactive: lambda closures are not supported in runtime mode.
Configure @lambdaql/compiler (ts-patch transformer) to enable closure capture.
```

Silence it by setting `NODE_ENV=production` or `NODE_ENV=test`.
