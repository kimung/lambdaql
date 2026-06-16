# @lambdaql/expression

> Parse des arrow functions JavaScript en AST typés — inspiré des LINQ expression trees de .NET.

## Installation

```sh
npm install @lambdaql/expression
```

## Usage

```ts
import { expression, toSql } from "@lambdaql/expression";

// Parse une lambda en AST
const ast = expression.lambda.parse((user: User) => user.age >= 21 && !user.deleted);

// Traduit l'AST en clause SQL (sans paramètres préparés — voir @lambdaql/data pour la prod)
const where = toSql(ast, "user");
// → "(age >= 21) AND NOT (deleted)"
```

## Architecture

```
Arrow function
      │
      ▼
   Lexer            (tokenizer acorn → stream de Token typés)
      │
      ▼
  LambdaParser      (parser Pratt / TDOP)
      │  ├─ Grammar          (parselets prefix + infix enregistrés)
      │  ├─ PrefixParselets  (Name, Constant, Group, ObjectLiteral, Unary)
      │  └─ InfixParselets   (Binary, Call/Property, Field, Separator, Lambda, Conditional)
      ▼
  LambdaExpression  (nœud racine de l'AST typé)
      │
      ▼
  Visitor<T>        (interface ExpressionVisitor — à implémenter pour traduire)
      ├─ toSql()    → clause WHERE SQL (chaîne brute)
      └─ ...        → filtre MongoDB, GraphQL, etc.
```

## Nœuds AST

| Nœud                      | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `NameExpression`          | Identifiant (`user`, `x`)                      |
| `ConstantExpression`      | Littéral (`21`, `'active'`, `true`, `null`)    |
| `BinaryExpression`        | Opérateur binaire (`&&`, `\|\|`, `>=`, `+`, …) |
| `UnaryExpression`         | Opérateur unaire (`!`, `-`)                    |
| `PropertyExpression`      | Accès propriété (`user.age`)                   |
| `MethodExpression`        | Appel de méthode (`email.includes('@')`)       |
| `ObjectLiteralExpression` | Projection objet (`{ id: u.id }`)              |
| `FieldExpression`         | Champ d'un objet littéral                      |
| `LambdaExpression`        | Nœud racine — args + corps                     |
| `ConditionalExpression`   | Ternaire (`condition ? a : b`)                 |
| `NullishExpression`       | Coalescence nulle (`a ?? b`)                   |

## Implémenter son propre visitor

```ts
import { visit, type ExpressionVisitor } from "@lambdaql/expression";

class MyVisitor implements ExpressionVisitor<string> {
  visitName(expr) {
    return expr.name;
  }
  visitConstant(expr) {
    return String(expr.value);
  }
  visitBinary(expr) {
    return `${visit(expr.left, this)} ${expr.operator} ${visit(expr.right, this)}`;
  }
  // … implémenter toutes les méthodes
}
```

## Précédences des opérateurs

| Groupe            | Opérateurs                              | Précédence |
| ----------------- | --------------------------------------- | ---------- |
| Lambda            | `=>`                                    | 150        |
| Appel / accès     | `()` `.`                                | 100        |
| Multiplicatif     | `*` `/` `%`                             | 70         |
| Additif           | `+` `-`                                 | 60         |
| Comparaison       | `===` `!==` `==` `!=` `<` `<=` `>` `>=` | 90         |
| AND logique       | `&&`                                    | 35         |
| OR logique        | `\|\|`                                  | 30         |
| Coalescence nulle | `??`                                    | 25         |

## Licence

MIT
