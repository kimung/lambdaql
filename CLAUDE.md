# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```sh
# Depuis la racine du monorepo
npm install            # installe toutes les dépendances (workspaces)
npm run build          # compile tous les packages (expression d'abord, data ensuite)
npm test               # lance tous les tests
npm run typecheck      # vérifie les types sans compiler

# Par package
cd packages/expression && npm test
cd packages/data && npm test

# Test unique (vitest)
cd packages/data && npx vitest run tests/translator.test.ts
cd packages/expression && npx vitest run tests/lexer.test.ts
```

`@gamn9/expression` doit être buildé avant `@gamn9/data` — le second en dépend.

## Structure du monorepo

```
packages/
├── expression/   @gamn9/expression — parser lambda → AST
└── data/         @gamn9/data       — query builder SQL
```

Racine : `package.json` (npm workspaces), `tsconfig.base.json` (options TS communes), `.gitignore`.  
Chaque package a son propre `tsconfig.json` qui étend `../../tsconfig.base.json` (sauf `expression` qui est autonome).

## Architecture — @gamn9/expression

Pipeline : `fn.toString()` → `Lexer` (acorn) → `Generator<Token>` → `LambdaParser` (Pratt) → `LambdaExpression`.

**Parser Pratt** (`src/parser/`) : `Grammar` enregistre des `PrefixParselet` et `InfixParselet` dans une `ParseletCollection`. `Parser.expression(precedence)` consomme des tokens, délègue aux parselets, retourne un nœud `Expression`.

**`SeparatorParselet`** (virgule) retourne un `Expression[]` casté en `Expression` — hack intentionnel pour la collecte des args de lambda. `LambdaParselet` vérifie `Array.isArray(left)` pour reconstituer le tableau.

**Visitor** (`src/utils/visitor.ts`) : `visit(expr, visitor)` dispatch par `expr.kind` via un switch exhaustif. Pour ajouter un type de nœud : créer la classe dans `src/parser/expression/`, l'exporter depuis `src/index.ts`, ajouter une méthode dans `ExpressionVisitor<T>`, et un case dans `visit()`.

**`toSql()`** (`src/utils/sql-visitor.ts`) : visitor simple pour le développement/debug. Génère du SQL par concaténation de chaînes — **ne pas utiliser en production**. Pour la prod, utiliser `@gamn9/data`.

## Architecture — @gamn9/data

Dépend de `@gamn9/expression` pour le parsing des lambdas.

**`Queryable<T>`** (`src/queryable.ts`) : immutable — chaque méthode retourne une nouvelle instance wrappant un `SelectExpression` mis à jour via `.patch()`. `toSql()` instancie un `SqlTranslator` et traduit.

**`SelectExpression`** (`src/expression/select.ts`) : accumule `where[]` (chaque `.filter()` ajoute une lambda), `joins[]`, `orders[]`, etc. `patch()` retourne une copie avec les champs overridés.

**`SqlTranslator`** (`src/sql/translator.ts`) : statefull — `_params[]` accumule les valeurs, `_aliases[]` = `['t0', 't1', ...]` (source + joins dans l'ordre). Chaque lambda a sa `aliasMap` : `lambda.args[i].name → _aliases[i]`. Règles importantes :
- Toutes les constantes (sauf `NULL`) → paramètres préparés `$1`, `$2`, …
- `=== null` / `== null` → `IS NULL` ; `!== null` / `!= null` → `IS NOT NULL`
- `PropertyExpression` avec alias `''` (DML) → nom de colonne nu ; avec alias `'t0'` (SELECT) → `t0.column`
- `%` → `MOD(a, b)` ; les wildcards SQL dans les valeurs LIKE sont échappés (`%` → `\%`, `_` → `\_`)

**Helpers DML** : `insertInto`, `updateIn`, `deleteFrom` dans `src/queryable.ts` — construisent les expressions depuis des objets plain et délèguent au `SqlTranslator`.

## Conventions

- **TypeScript strict** + `NodeNext` modules — tous les imports locaux portent l'extension `.js`
- Les classes d'expression ont un champ `readonly kind = 'XxxExpression' as const` utilisé comme discriminant
- Pas de commentaires sauf pour les cas non-évidents
- Tests avec **vitest** — couvrir les cas NULL, les wildcards LIKE, les précédences arithmétiques (bugs historiques)
