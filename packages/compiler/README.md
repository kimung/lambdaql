# @lambdaql/compiler

TypeScript Custom Transformer for [@lambdaql/data](../data) — compiles query lambdas to AST at build time, eliminating the runtime `fn.toString()` overhead.

## What it does

At compile time, arrow functions passed to `Queryable` methods (`filter`, `select`, `join`, etc.) are replaced by their pre-built `@lambdaql/expression` AST. This removes the runtime parsing step and enables closure capture — external variables are wrapped as live `ConstantExpression` references.

```ts
// Source
from<User>("user").filter((u) => u.age > minAge);

// After AOT compilation (conceptually)
from<User>("user").filter(
  new LambdaExpression(
    new BinaryExpression(new PropertyExpression(new NameExpression("u"), "age"), ">", new ConstantExpression(minAge)),
    [new NameExpression("u")],
  ),
);
```

## Setup

Install [ts-patch](https://github.com/nonara/ts-patch):

```sh
npm install --save-dev ts-patch @lambdaql/compiler
npx ts-patch install
```

Add the transformer to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "transform": "@lambdaql/compiler" }]
  }
}
```

## Fallback

When a real `ts.Program` with TypeChecker is not available (e.g. `transpileModule`, ESBuild, Jest with `ts-jest` in isolated mode), the transformer is a no-op and `@lambdaql/data` falls back to runtime parsing via `fn.toString()`. No configuration required.

## Closure capture

External variables are captured as live references:

```ts
const ids = [1, 2, 3];
from<User>("user").filter((u) => ids.includes(u.id));
// → u.id IN ($1, $2, $3)  — ids is read at query execution time
```

Without the AOT compiler, closure arrays must be inlined as literal arrays in the lambda.
