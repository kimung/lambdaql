import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer/index.js";
import { LambdaParser } from "../src/parser/lambda.js";
import { toSql } from "../src/utils/sql-visitor.js";

function sql(src: string, param = "u") {
  const ast = new LambdaParser(new Lexer(src)).parse();
  return toSql(ast, param);
}

describe("toSql visitor", () => {
  it("simple >=", () => expect(sql("u => u.age >= 21")).toBe("(age >= 21)"));
  it("AND", () => expect(sql("u => u.age >= 18 && u.active === true")).toBe("((age >= 18) AND (active = 1))"));
  it("OR", () => expect(sql('u => u.admin === true || u.role === "mod"')).toBe("((admin = 1) OR (role = 'mod'))"));
  it("NOT", () => expect(sql("u => !u.deleted")).toBe("NOT (deleted)"));
  it("strict equality → =", () => expect(sql('u => u.status === "active"')).toBe("(status = 'active')"));
  it("strict inequality → !=", () => expect(sql('u => u.status !== "banned"')).toBe("(status != 'banned')"));
  it("null constant", () => expect(sql("u => u.deletedAt === null")).toBe("(deletedAt = NULL)"));
  it("includes() → LIKE", () => expect(sql('u => u.email.includes("gmail")')).toBe("email LIKE '%gmail%'"));
  it("startsWith() → LIKE", () => expect(sql('u => u.name.startsWith("Kim")')).toBe("name LIKE 'Kim%'"));
  it("endsWith() → LIKE", () => expect(sql('u => u.name.endsWith("son")')).toBe("name LIKE '%son'"));
  it("includes() escapes wildcards", () =>
    expect(sql('u => u.email.includes("a%_b")')).toBe("email LIKE '%a\\%\\_b%'"));
  it("ternary → CASE WHEN", () =>
    expect(sql('u => u.age >= 18 ? "adult" : "minor"')).toBe("CASE WHEN (age >= 18) THEN 'adult' ELSE 'minor' END"));
  it("nested property", () => expect(sql('u => u.address.city === "Paris"')).toBe("(address.city = 'Paris')"));
});
