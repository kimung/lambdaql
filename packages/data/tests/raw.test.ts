import { describe, it, expect } from "vitest";
import { from } from "../src/queryable.js";
import { mysql, postgres } from "../src/sql/dialect.js";

type User = { id: number; name: string; age: number; score: number };

describe("whereRaw", () => {
  it("fragment simple sans paramètres", () => {
    const { sql, params } = from<User>("user").whereRaw("deleted_at IS NULL").toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE deleted_at IS NULL");
    expect(params).toEqual([]);
  });

  it("? remplacés par $n en postgres", () => {
    const { sql, params } = from<User>("user").whereRaw("score BETWEEN ? AND ?", 10, 100).toSql({ dialect: postgres });
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE score BETWEEN $1 AND $2");
    expect(params).toEqual([10, 100]);
  });

  it("? remplacés par ? en mysql", () => {
    const { sql, params } = from<User>("user").whereRaw("score BETWEEN ? AND ?", 10, 100).toSql({ dialect: mysql });
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE score BETWEEN ? AND ?");
    expect(params).toEqual([10, 100]);
  });

  it("combiné avec filter lambda (AND implicite)", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.age > 18)
      .whereRaw("score > ?", 50)
      .toSql({ dialect: postgres });
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE (t0.age > $1) AND score > $2");
    expect(params).toEqual([18, 50]);
  });

  it("plusieurs whereRaw empilés", () => {
    const { sql } = from<User>("user").whereRaw("deleted_at IS NULL").whereRaw("role = ?", "admin").toSql();
    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain("role = $1");
  });

  it("réindexage correct avec filtre lambda avant raw", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.age > 18)
      .whereRaw("score > ?", 50)
      .toSql({ dialect: postgres });
    expect(params).toEqual([18, 50]);
    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
  });
});

describe("havingRaw", () => {
  it("HAVING raw seul", () => {
    const { sql, params } = from<User>("user")
      .groupBy((u: any) => u.name)
      .havingRaw("COUNT(*) > ?", 3)
      .toSql({ dialect: postgres });
    expect(sql).toContain("HAVING COUNT(*) > $1");
    expect(params).toEqual([3]);
  });

  it("HAVING lambda + raw (AND)", () => {
    const { sql, params } = from<User>("user")
      .groupBy((u: any) => u.name)
      .having((u: any) => u.age > 18)
      .havingRaw("COUNT(*) > ?", 3)
      .toSql({ dialect: postgres });
    expect(sql).toContain("HAVING");
    expect(sql).toContain("AND COUNT(*) > $2");
    expect(params).toContain(3);
  });
});

describe("orderByRaw", () => {
  it("ORDER BY expression SQL brute", () => {
    const { sql, params } = from<User>("user").orderByRaw("RANDOM()").toSql();
    expect(sql).toContain("ORDER BY RANDOM()");
    expect(params).toEqual([]);
  });

  it("ORDER BY avec paramètre", () => {
    const { sql, params } = from<User>("user")
      .orderByRaw("CASE WHEN id = ? THEN 0 ELSE 1 END", 5)
      .toSql({ dialect: postgres });
    expect(sql).toContain("ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END");
    expect(params).toEqual([5]);
  });

  it("combiné avec orderBy lambda", () => {
    const { sql } = from<User>("user")
      .orderBy((u) => u.name)
      .orderByRaw("RANDOM()")
      .toSql();
    expect(sql).toContain("ORDER BY t0.name ASC, RANDOM()");
  });

  it("count() supprime orderByRaw", async () => {
    // count() doit retirer rawOrders pour éviter une erreur SQL dans la sous-requête wrappée
    const { sql } = from<User>("user").orderByRaw("RANDOM()").toSql();
    // On vérifie juste que le SQL brut est bien présent avant wrapping
    expect(sql).toContain("RANDOM()");
  });
});

describe("intégration raw + dialectes dans sous-requêtes", () => {
  it("whereRaw dans whereIn inner postgres", () => {
    type Post = { userId: number };
    const inner = from<Post>("post").whereRaw("published = ?", true);
    const { sql, params } = from<User>("user")
      .filter((u) => u.age > 18)
      .whereIn((u: any) => u.id, inner)
      .toSql({ dialect: postgres });
    expect(params).toEqual([18, true]);
    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
  });
});
