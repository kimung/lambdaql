import { describe, it, expect } from "vitest";
import { from } from "../src/queryable.js";
import { postgres, mysql, sqlite } from "../src/sql/dialect.js";

type Event = { id: number; createdAt: Date; score: number; value: number };

describe("Fonctions de date — postgres/mysql (EXTRACT)", () => {
  it("getFullYear → EXTRACT(YEAR FROM ...)", () => {
    const { sql, params } = from<Event>("event")
      .filter((e: any) => e.createdAt.getFullYear() === 2024)
      .toSql({ dialect: postgres });
    expect(sql).toContain("EXTRACT(YEAR FROM t0.createdAt)");
    expect(params).toContain(2024);
  });

  it("getMonth → EXTRACT(MONTH FROM ...)", () => {
    const { sql } = from<Event>("event")
      .filter((e: any) => e.createdAt.getMonth() === 1)
      .toSql({ dialect: mysql });
    expect(sql).toContain("EXTRACT(MONTH FROM t0.createdAt)");
  });

  it("getDate → EXTRACT(DAY FROM ...)", () => {
    const { sql } = from<Event>("event")
      .select((e: any) => ({ d: e.createdAt.getDate() }))
      .toSql({ dialect: postgres });
    expect(sql).toContain("EXTRACT(DAY FROM t0.createdAt)");
  });

  it("getHours/getMinutes/getSeconds", () => {
    const { sql } = from<Event>("event")
      .filter((e: any) => e.createdAt.getHours() === 12)
      .toSql({ dialect: postgres });
    expect(sql).toContain("EXTRACT(HOUR FROM t0.createdAt)");
  });
});

describe("Fonctions de date — sqlite (strftime)", () => {
  it("getFullYear → strftime", () => {
    const { sql } = from<Event>("event")
      .filter((e: any) => e.createdAt.getFullYear() === 2024)
      .toSql({ dialect: sqlite });
    expect(sql).toContain("CAST(strftime('%Y', t0.createdAt) AS INTEGER)");
  });

  it("getMonth → strftime %m", () => {
    const { sql } = from<Event>("event")
      .filter((e: any) => e.createdAt.getMonth() === 6)
      .toSql({ dialect: sqlite });
    expect(sql).toContain("CAST(strftime('%m', t0.createdAt) AS INTEGER)");
  });

  it("getDate → strftime %d", () => {
    const { sql } = from<Event>("event")
      .filter((e: any) => e.createdAt.getDate() === 15)
      .toSql({ dialect: sqlite });
    expect(sql).toContain("CAST(strftime('%d', t0.createdAt) AS INTEGER)");
  });
});

describe("Fonctions Math", () => {
  it("Math.floor → FLOOR()", () => {
    const { sql, params } = from<Event>("event")
      .select((e: any) => ({ f: Math.floor(e.score) }))
      .toSql({ dialect: postgres });
    expect(sql).toContain("FLOOR(t0.score)");
    expect(params).toEqual([]);
  });

  it("Math.ceil → CEIL()", () => {
    const { sql } = from<Event>("event")
      .select((e: any) => ({ c: Math.ceil(e.score) }))
      .toSql({ dialect: mysql });
    expect(sql).toContain("CEIL(t0.score)");
  });

  it("Math.round → ROUND()", () => {
    const { sql } = from<Event>("event")
      .select((e: any) => ({ r: Math.round(e.score) }))
      .toSql({ dialect: sqlite });
    expect(sql).toContain("ROUND(t0.score)");
  });

  it("Math.abs → ABS()", () => {
    const { sql } = from<Event>("event")
      .filter((e: any) => Math.abs(e.value) > 10)
      .toSql({ dialect: postgres });
    expect(sql).toContain("ABS(t0.value)");
  });

  it("Math dans filter avec comparaison", () => {
    const { sql, params } = from<Event>("event")
      .filter((e: any) => Math.floor(e.score) === 5)
      .toSql({ dialect: postgres });
    expect(sql).toContain("FLOOR(t0.score)");
    expect(params).toContain(5);
  });
});
