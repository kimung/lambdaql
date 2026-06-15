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
cd packages/compiler && npm test
cd packages/mikro-orm && npm test

# Test unique (vitest)
cd packages/data && npx vitest run tests/translator.test.ts
cd packages/expression && npx vitest run tests/lexer.test.ts
```

L'ordre de build : `expression` → `data` → `compiler` et `mikro-orm` (ces deux dépendent de `data`).

## Structure du monorepo

```
packages/
├── expression/   @gamn9/expression  — lexer (acorn) + parser Pratt → AST typé
├── data/         @gamn9/data        — query builder SQL (Queryable<T>, SqlTranslator)
├── compiler/     @gamn9/compiler    — TypeScript custom transformer AOT (ts-patch)
└── mikro-orm/    @gamn9/mikro-orm   — intégration MikroORM QueryBuilder
```

Racine : `package.json` (npm workspaces), `tsconfig.base.json` (options TS communes), `.gitignore`.  
Chaque package a son propre `tsconfig.json` qui étend `../../tsconfig.base.json` (sauf `expression` qui est autonome).

## Architecture — @gamn9/expression

Pipeline : `fn.toString()` → `Lexer` (acorn) → `Generator<Token>` → `LambdaParser` (Pratt) → `LambdaExpression`.

**Parser Pratt** (`src/parser/`) : `Grammar` enregistre des `PrefixParselet` et `InfixParselet` dans une `ParseletCollection`. `Parser.expression(precedence)` consomme des tokens, délègue aux parselets, retourne un nœud `Expression`.

**`SeparatorParselet`** (virgule) : précédence `SEPARATOR_PRECEDENCE = 5` — volontairement la plus basse de tous les opérateurs (sous le ternaire à 20). Les parselets d'éléments (objet, tableau, appel) parsent leurs valeurs avec ce seuil pour englober tout opérateur (`??`, `||`, `&&`, `?:`, …) et ne s'arrêter qu'à la virgule. `SeparatorParselet.parse()` retourne un `Expression[]` casté en `Expression` — hack intentionnel pour la collecte des args de lambda. `LambdaParselet` vérifie `Array.isArray(left)` pour reconstituer le tableau.

**Visitor** (`src/utils/visitor.ts`) : `visit(expr, visitor)` dispatch par `expr.kind` via un switch exhaustif. Pour ajouter un type de nœud : créer la classe dans `src/parser/expression/`, l'exporter depuis `src/index.ts`, ajouter une méthode dans `ExpressionVisitor<T>`, et un case dans `visit()`.

**`toSql()`** (`src/utils/sql-visitor.ts`) : visitor simple pour le développement/debug. Génère du SQL par concaténation de chaînes — **ne pas utiliser en production**. Pour la prod, utiliser `@gamn9/data`.

## Architecture — @gamn9/data

Dépend de `@gamn9/expression` pour le parsing des lambdas.

**`Queryable<T>`** (`src/queryable.ts`) : immutable — chaque méthode retourne une nouvelle instance wrappant un `SelectExpression` mis à jour via `.patch()`. `toSql()` instancie un `SqlTranslator` et traduit.

**`SelectExpression`** (`src/expression/select.ts`) : accumule `where[]` (chaque `.filter()` ajoute une lambda), `joins[]`, `orders[]`, etc. `patch()` retourne une copie avec les champs overridés.

**`SqlTranslator`** (`src/sql/translator.ts`) : stateful — `_params[]` accumule les valeurs, `_aliases[]` = `['t0', 't1', ...]` (source + joins dans l'ordre). Règles importantes :
- Toutes les constantes (sauf `NULL`) → paramètres préparés `$1`, `$2`, …
- `=== null` / `== null` → `IS NULL` ; `!== null` / `!= null` → `IS NOT NULL`
- `PropertyExpression` avec alias `''` (DML) → nom de colonne nu ; avec alias `'t0'` (SELECT) → `t0.column`
- `%` → `MOD(a, b)` ; `??` → `COALESCE(a, b)` ; les wildcards SQL dans les valeurs LIKE sont échappés (`%` → `\%`, `_` → `\_`)
- Les prédicats de JOIN utilisent `joinAliasMap(predicate, idx)` : le dernier argument désigne la table jointe (`t{idx}`), le premier la source (`t0`). Ne pas utiliser `aliasMap()` pour les JOINs — le mapping positionnel naïf produit des alias faux dès le 2ᵉ join.
- `columns()` gère les projections scalaires (`select(u => u.name)`) et objet (`select(u => ({ id: u.id }))`)

**Helpers DML** : `insertInto`, `updateIn`, `deleteFrom` dans `src/queryable.ts` — construisent les expressions depuis des objets plain et délèguent au `SqlTranslator`. Ces helpers n'acceptent pas de `NamingStrategy` (les colonnes sont prises telles quelles depuis les clés de l'objet).

## Architecture — @gamn9/compiler

Transformer TypeScript AOT (Custom Transformer, compatible ts-patch). Remplace les arrow functions passées aux méthodes de `Queryable<T>` par leur AST `@gamn9/expression` à la compilation, évitant le parsing runtime via `fn.toString()`.

- Fonctionne uniquement avec un vrai `ts.Program` (TypeChecker disponible) — le fallback runtime prend le relais avec `transpileModule` / ESBuild.
- Vérifie `isQueryable()` via le TypeChecker pour éviter les faux positifs sur d'autres `.filter()`.
- Gère les closures : un identifiant externe est emballé en `{ kind: 'ConstantExpression', value: <ref> }` pour conserver la référence vive.

## Architecture — @gamn9/mikro-orm

Intègre `Queryable<T>` avec le QueryBuilder MikroORM. Point d'entrée : `applyQueryable(qb, queryable, options?)`.

- Traduit les conditions en `qb.andWhere(sql, params)` avec des paramètres positionnels `?` (format MikroORM QB, non `$1`).
- Supporte l'auto-join depth-N : analyse les lambdas pour détecter les chaînes de navigation (`u.company.country.name`) et appelle `qb.leftJoin()` si le segment est une relation dans les métadonnées MikroORM.
- `createNamingFromMikroOrm(orm, entityMeta?)` : dérive une `NamingStrategy` depuis la `NamingStrategy` MikroORM, avec priorité au `fieldName` explicite (`@Property({ fieldName })`).
- Ne supporte pas `UNION` — lance une erreur explicite, utiliser le QB MikroORM directement dans ce cas.

## Conventions

- **TypeScript strict** + `NodeNext` modules — tous les imports locaux portent l'extension `.js`
- Les classes d'expression ont un champ `readonly kind = 'XxxExpression' as const` utilisé comme discriminant
- Pas de commentaires sauf pour les cas non-évidents
- Tests avec **vitest** — couvrir les cas NULL, les wildcards LIKE, les précédences arithmétiques, `??`/`||`/`?:` dans les valeurs d'objet/tableau/arguments, et les JOINs multiples (bugs historiques)
