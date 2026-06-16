import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NameExpression,
  LambdaExpression,
  PropertyExpression,
  BinaryExpression,
  ConstantExpression,
  MethodExpression,
} from "@lambdaql/expression";
import { from } from "../src/queryable.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function closureLambda(paramName: string, externalRef: string) {
  // Simule (param) => param.age > externalRef — ce que fn.toString() produirait sans AOT
  // BinaryExpression(left, right, operator) — noter l'ordre des arguments
  return new LambdaExpression(
    new BinaryExpression(
      new PropertyExpression(new NameExpression(paramName), "age"),
      new NameExpression(externalRef), // ← closure non résolue : devrait être ConstantExpression avec AOT
      ">",
    ),
    [new NameExpression(paramName)],
  );
}

function safeLambda(paramName: string) {
  return new LambdaExpression(
    new BinaryExpression(new PropertyExpression(new NameExpression(paramName), "age"), new ConstantExpression(18), ">"),
    [new NameExpression(paramName)],
  );
}

// ── Erreur explicite sur les closures non résolues ──────────────────────────

describe("closure non résolue — erreur explicite", () => {
  it("throw si un identifiant hors paramètres est dans la lambda", () => {
    const lambda = closureLambda("u", "minAge");
    expect(() => from<{ age: number }>("user").filter(lambda).toSql()).toThrowError(/minAge/);
  });

  it("le message d'erreur mentionne @lambdaql/compiler", () => {
    const lambda = closureLambda("u", "limit");
    expect(() => from<{ age: number }>("user").filter(lambda).toSql()).toThrowError(/@lambdaql\/compiler/);
  });

  it("ne throw pas quand tous les identifiants sont des paramètres lambda valides", () => {
    const lambda = safeLambda("u");
    expect(() => from<{ age: number }>("user").filter(lambda).toSql()).not.toThrow();
  });

  it("ne throw pas pour un identifiant Math (global connu)", () => {
    const lambda = new LambdaExpression(
      new MethodExpression(new NameExpression("Math"), "floor", [
        new PropertyExpression(new NameExpression("e"), "salary"),
      ]),
      [new NameExpression("e")],
    );
    expect(() => from<{ salary: number }>("employee").select(lambda).toSql()).not.toThrow();
  });
});

// ── Avertissement dev quand le fallback runtime est actif ────────────────────

describe("avertissement dev — fallback runtime", () => {
  const originalNodeEnv = process.env["NODE_ENV"];

  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env["NODE_ENV"] = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("émet un warning en mode development lors du premier appel runtime", async () => {
    process.env["NODE_ENV"] = "development";
    const { from: freshFrom } = await import("../src/queryable.js");
    freshFrom<{ age: number }>("user")
      .filter((u) => u.age > 18)
      .toSql();
    expect(console.warn).toHaveBeenCalledOnce();
    expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toMatch(/@lambdaql\/compiler/);
  });

  it("n'émet le warning qu'une seule fois même avec plusieurs lambdas", async () => {
    process.env["NODE_ENV"] = "development";
    const { from: freshFrom } = await import("../src/queryable.js");
    freshFrom<{ age: number }>("user")
      .filter((u) => u.age > 18)
      .toSql();
    freshFrom<{ age: number }>("user")
      .filter((u) => u.age < 99)
      .toSql();
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("n'émet pas de warning en mode production", async () => {
    process.env["NODE_ENV"] = "production";
    const { from: freshFrom } = await import("../src/queryable.js");
    freshFrom<{ age: number }>("user")
      .filter((u) => u.age > 18)
      .toSql();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("n'émet pas de warning quand la lambda est un AST pré-compilé (chemin AOT)", async () => {
    process.env["NODE_ENV"] = "development";
    const { from: freshFrom } = await import("../src/queryable.js");
    const precompiled = safeLambda("u");
    freshFrom<{ age: number }>("user").filter(precompiled).toSql();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
