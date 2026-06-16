# @lambdaql

Monorepo TypeScript — parse des arrow functions JavaScript en AST typés et les traduit en SQL avec paramètres préparés.

## Packages

| Package                                         | Description                                                   |
| ----------------------------------------------- | ------------------------------------------------------------- |
| [`@lambdaql/expression`](./packages/expression) | Parse des arrow functions en AST typés (lexer + parser Pratt) |
| [`@lambdaql/data`](./packages/data)             | Query builder SQL fluent construit sur `@lambdaql/expression` |

## Démarrage rapide

```sh
npm install
npm run build
npm test
```

## Architecture

```
Arrow function JS
      │
      ▼
 @lambdaql/expression
   Lexer (acorn)  →  Parser Pratt  →  LambdaExpression (AST typé)
      │
      ▼
 @lambdaql/data
   Queryable<T>   →  SqlTranslator  →  { sql, params }
```

## Commandes

```sh
npm run build     # compile tous les packages
npm test          # lance tous les tests
npm run typecheck # vérifie les types sans compiler
```

## Développement

Les packages sont liés par npm workspaces. Après `npm install` à la racine, `@lambdaql/expression` est disponible comme dépendance locale de `@lambdaql/data`.

```sh
# Travailler sur un seul package
cd packages/expression && npm test
cd packages/data && npm test
```
