# Vite / esbuild / Rollup / webpack

`@lambdaql/unplugin` is the AOT plugin for bundlers. It transforms LambdaQL lambdas to pre-built ASTs at bundle time, eliminating all runtime parsing overhead.

See the [AOT Compiler guide](/guide/aot-compiler) for background.

## Install

```sh
npm install --save-dev @lambdaql/unplugin
```

## Setup

::: code-group

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { vitePlugin } from "@lambdaql/unplugin";

export default defineConfig({
  plugins: [vitePlugin()],
});
```

```ts [esbuild]
import { build } from "esbuild";
import { esbuildPlugin } from "@lambdaql/unplugin";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  plugins: [esbuildPlugin()],
});
```

```js [rollup.config.js]
import { rollupPlugin } from "@lambdaql/unplugin";

export default {
  input: "src/index.ts",
  plugins: [rollupPlugin()],
};
```

```js [webpack.config.js]
const { webpackPlugin } = require("@lambdaql/unplugin");

module.exports = {
  plugins: [webpackPlugin()],
};
```

:::

## How it works

The plugin transforms every `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs` file. For each lambda passed to a LambdaQL method (`filter`, `select`, `orderBy`, etc.), it replaces the arrow function with the equivalent `@lambdaql/expression` AST object inline.

This is equivalent to the [ts-patch transformer](/guide/aot-compiler#ts-patch) but works with any bundler — no TypeScript compiler patching required.

## When to use which

|                    | `@lambdaql/compiler` (ts-patch) | `@lambdaql/unplugin` |
| ------------------ | ------------------------------- | -------------------- |
| Works with `tsc`   | ✅                              | ❌                   |
| Works with Vite    | ❌                              | ✅                   |
| Works with esbuild | ❌                              | ✅                   |
| Needs TypeChecker  | ✅ (safer)                      | ❌                   |
| Setup complexity   | Patch TypeScript once           | Add a plugin         |

Use `@lambdaql/compiler` for Node.js projects built with `tsc`. Use `@lambdaql/unplugin` for frontend or fullstack projects using Vite, esbuild, or a similar bundler.
