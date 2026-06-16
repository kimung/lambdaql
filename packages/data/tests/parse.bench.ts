import { bench, describe } from "vitest";
import {
  LambdaExpression,
  NameExpression,
  BinaryExpression,
  ConstantExpression,
  PropertyExpression,
  ObjectLiteralExpression,
  FieldExpression,
} from "@gamn9/expression";
import { from } from "../src/queryable.js";

type Row = { id: number; name: string; age: number };

// ── filter : u => u.age > 18 ──────────────────────────────────────────────────

const uFilter = new NameExpression("u");
const filterAst = new LambdaExpression(
  new BinaryExpression(new PropertyExpression(uFilter, "age"), new ConstantExpression(18), ">"),
  [uFilter],
);

describe("filter() : runtime parse vs AST précompilé", () => {
  bench("runtime  — fn.toString() → Lexer → Parser → SqlTranslator", () => {
    from<Row>("user")
      .filter((u) => u.age > 18)
      .toSql();
  });

  bench("AOT      — AST précompilé → SqlTranslator (zéro parsing)", () => {
    from<Row>("user").filter(filterAst).toSql();
  });
});

// ── select : u => ({ id: u.id, name: u.name, age: u.age }) ───────────────────

const uSel = new NameExpression("u");
const selectAst = new LambdaExpression(
  new ObjectLiteralExpression([
    new FieldExpression("id", new PropertyExpression(uSel, "id")),
    new FieldExpression("name", new PropertyExpression(uSel, "name")),
    new FieldExpression("age", new PropertyExpression(uSel, "age")),
  ]),
  [uSel],
);

describe("select() : runtime parse vs AST précompilé", () => {
  bench("runtime  — fn.toString() → Lexer → Parser → SqlTranslator", () => {
    from<Row>("user")
      .select((u) => ({ id: u.id, name: u.name, age: u.age }))
      .toSql();
  });

  bench("AOT      — AST précompilé → SqlTranslator (zéro parsing)", () => {
    from<Row>("user").select(selectAst).toSql();
  });
});
