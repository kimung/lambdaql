# @gamn9

Monorepo TypeScript — parse des arrow functions JavaScript en AST typés et les traduit en SQL avec paramètres préparés.

## Packages

| Package | Description |
|---|---|
| [`@gamn9/expression`](./packages/expression) | Parse des arrow functions en AST typés (lexer + parser Pratt) |
| [`@gamn9/data`](./packages/data) | Query builder SQL fluent construit sur `@gamn9/expression` |

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
 @gamn9/expression
   Lexer (acorn)  →  Parser Pratt  →  LambdaExpression (AST typé)
      │
      ▼
 @gamn9/data
   Queryable<T>   →  SqlTranslator  →  { sql, params }
```

## Commandes

```sh
npm run build     # compile tous les packages
npm test          # lance tous les tests
npm run typecheck # vérifie les types sans compiler
```

## Développement

Les packages sont liés par npm workspaces. Après `npm install` à la racine, `@gamn9/expression` est disponible comme dépendance locale de `@gamn9/data`.

```sh
# Travailler sur un seul package
cd packages/expression && npm test
cd packages/data && npm test
```
