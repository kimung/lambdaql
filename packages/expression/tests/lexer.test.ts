import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer/index.js";
import { TokenKind } from "../src/token/kind.js";
import { TokenType } from "../src/token/type.js";

function tokens(src: string) {
  return Array.from(new Lexer(src).tokenize());
}

describe("Lexer", () => {
  it("tokenizes identifier + arrow", () => {
    const toks = tokens("x => x");
    expect(toks[0]!.key).toBe(TokenType.IDENTIFIER);
    expect(toks[0]!.value).toBe("x");
    expect(toks[1]!.key).toBe(TokenType.ARROW);
  });

  it("tokenizes integer literal", () => {
    const toks = tokens("u => 42");
    expect(toks[2]!.kind).toBe(TokenKind.Integer);
    expect(toks[2]!.value).toBe(42);
  });

  it("tokenizes float literal", () => {
    const toks = tokens("u => 3.14");
    expect(toks[2]!.kind).toBe(TokenKind.Float);
    expect(toks[2]!.value).toBe(3.14);
  });

  it("strips quotes from string literals", () => {
    const toks = tokens('u => "hello"');
    expect(toks[2]!.kind).toBe(TokenKind.String);
    expect(toks[2]!.value).toBe("hello");
  });

  it("tokenizes boolean literals", () => {
    const toks = tokens("u => true");
    expect(toks[2]!.kind).toBe(TokenKind.Boolean);
    expect(toks[2]!.value).toBe(true);
  });

  it("tokenizes null literal", () => {
    const toks = tokens("u => null");
    expect(toks[2]!.kind).toBe(TokenKind.Null);
    expect(toks[2]!.value).toBe(null);
  });

  it("tokenizes multi-param arrow function", () => {
    const toks = tokens("(a, b) => a");
    expect(toks.map((t) => t.key)).toContain(TokenType.ARROW);
    expect(toks.map((t) => t.key)).toContain(TokenType.COMMA);
  });

  it("tokenizes comparison operators", () => {
    const toks = tokens("u => u.age >= 18");
    const keys = toks.map((t) => t.key);
    expect(keys).toContain(TokenType.GTE);
  });

  it("propage la position (line/col) depuis acorn", () => {
    const toks = tokens("u => 42");
    expect(toks[0]!.line).toBe(1);
    expect(toks[0]!.col).toBe(0);
    // '42' commence à la colonne 5
    expect(toks[2]!.col).toBe(5);
  });
});
