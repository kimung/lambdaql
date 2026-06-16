import { describe, it, expect } from "vitest";
import { from, insertInto, updateIn, deleteFrom } from "../src/queryable.js";
import { snakeCaseNaming } from "../src/naming.js";
import {
  ConstantExpression,
  MethodExpression,
  NameExpression,
  LambdaExpression,
  PropertyExpression,
} from "@gamn9/expression";

type User = { id: number; name: string; age: number; active: boolean; deletedAt: string | null; email: string };
type Post = { id: number; userId: number; title: string; published: boolean };

describe("SELECT — basique", () => {
  it("select *", () => {
    const { sql, params } = from<User>("user").toSql();
    expect(sql).toBe("SELECT * FROM user AS t0");
    expect(params).toEqual([]);
  });

  it("filter >=", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.age >= 18)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE (t0.age >= $1)");
    expect(params).toEqual([18]);
  });

  it("NOT (unaire !)", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => !u.active)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE NOT (t0.active)");
    expect(params).toEqual([]);
  });

  it("deux filtres → AND implicite", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.age >= 18)
      .filter((u) => u.active)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE (t0.age >= $1) AND t0.active");
    expect(params).toEqual([18]);
  });

  it("OR dans un seul filtre", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.age < 18 || u.active)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE ((t0.age < $1) OR t0.active)");
    expect(params).toEqual([18]);
  });
});

describe("SELECT — NULL", () => {
  it("=== null → IS NULL", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.deletedAt === null)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.deletedAt IS NULL");
    expect(params).toEqual([]);
  });

  it("!== null → IS NOT NULL", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.deletedAt !== null)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.deletedAt IS NOT NULL");
    expect(params).toEqual([]);
  });
});

describe("SELECT — chaînes de méthodes", () => {
  it("includes → LIKE %..%", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.email.includes("gmail"))
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.email LIKE $1");
    expect(params).toEqual(["%gmail%"]);
  });

  it("startsWith → LIKE ..%", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.name.startsWith("Kim"))
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.name LIKE $1");
    expect(params).toEqual(["Kim%"]);
  });

  it("endsWith → LIKE %..", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.name.endsWith("son"))
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.name LIKE $1");
    expect(params).toEqual(["%son"]);
  });

  it("includes() échappe les wildcards SQL", () => {
    const { sql, params } = from<User>("user")
      .filter((u) => u.email.includes("a%_b"))
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.email LIKE $1");
    expect(params).toEqual(["%a\\%\\_b%"]);
  });

  it("toLowerCase", () => {
    const { sql, params } = from<User>("user")
      .filter((u: any) => u.name.toLowerCase() === "kim")
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE (LOWER(t0.name) = $1)");
    expect(params).toEqual(["kim"]);
  });

  it("trim → TRIM", () => {
    const { sql, params } = from<User>("user")
      .filter((u: any) => u.name.trim() === "kim")
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE (TRIM(t0.name) = $1)");
    expect(params).toEqual(["kim"]);
  });

  it("replace → REPLACE", () => {
    const { sql, params } = from<User>("user")
      .select((u: any) => ({ name: u.name.replace("a", "b") }))
      .toSql();
    expect(sql).toBe("SELECT REPLACE(t0.name, $1, $2) AS name FROM user AS t0");
    expect(params).toEqual(["a", "b"]);
  });

  it("length → LENGTH", () => {
    const { sql, params } = from<User>("user")
      .filter((u: any) => u.name.length > 3)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE (LENGTH(t0.name) > $1)");
    expect(params).toEqual([3]);
  });
});

describe("SELECT — projection", () => {
  it("select avec ObjectLiteralExpression", () => {
    const { sql, params } = from<User>("user")
      .select((u) => ({ id: u.id, name: u.name }))
      .toSql();
    expect(sql).toBe("SELECT t0.id AS id, t0.name AS name FROM user AS t0");
    expect(params).toEqual([]);
  });
});

describe("SELECT — modificateurs", () => {
  it("take → LIMIT", () => {
    const { sql } = from<User>("user").take(10).toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 LIMIT 10");
  });

  it("skip → OFFSET", () => {
    const { sql } = from<User>("user").skip(20).toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 OFFSET 20");
  });

  it("take + skip → LIMIT OFFSET", () => {
    const { sql } = from<User>("user").take(10).skip(20).toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 LIMIT 10 OFFSET 20");
  });

  it("distinct", () => {
    const { sql } = from<User>("user").distinct().toSql();
    expect(sql).toBe("SELECT DISTINCT * FROM user AS t0");
  });

  it("orderBy ASC", () => {
    const { sql } = from<User>("user")
      .orderBy((u) => u.name)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 ORDER BY t0.name ASC");
  });

  it("orderByDesc DESC", () => {
    const { sql } = from<User>("user")
      .orderByDesc((u) => u.age)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 ORDER BY t0.age DESC");
  });

  it("groupBy", () => {
    const { sql } = from<User>("user")
      .groupBy((u) => u.active)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 GROUP BY t0.active");
  });

  it("having → HAVING", () => {
    const { sql, params } = from<User>("user")
      .groupBy((u) => u.active)
      .having((u: any) => u.age > 18)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 GROUP BY t0.active HAVING (t0.age > $1)");
    expect(params).toEqual([18]);
  });

  it("having avec agrégat", () => {
    const { sql, params } = from<User>("user")
      .groupBy((u) => u.active)
      .having((u: any) => u.id.count() > 5)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 GROUP BY t0.active HAVING (COUNT(t0.id) > $1)");
    expect(params).toEqual([5]);
  });
});

describe("SELECT — JOIN", () => {
  it("INNER JOIN", () => {
    const { sql, params } = from<User>("user")
      .join(from<Post>("post"), (u, p) => u.id === p.userId)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 INNER JOIN post AS t1 ON (t0.id = t1.userId)");
    expect(params).toEqual([]);
  });

  it("LEFT JOIN", () => {
    const { sql } = from<User>("user")
      .leftJoin(from<Post>("post"), (u, p) => u.id === p.userId)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 LEFT JOIN post AS t1 ON (t0.id = t1.userId)");
  });

  it("JOIN + filtre multi-param", () => {
    const { sql, params } = from<User>("user")
      .join(from<Post>("post"), (u, p) => u.id === p.userId)
      .filter((u: any, p: any) => u.active && p.published)
      .toSql();
    expect(sql).toBe(
      "SELECT * FROM user AS t0 INNER JOIN post AS t1 ON (t0.id = t1.userId) WHERE (t0.active AND t1.published)",
    );
    expect(params).toEqual([]);
  });
});

describe("SELECT — coalesce (??)", () => {
  it("?? → COALESCE", () => {
    const { sql, params } = from<User>("user")
      .filter((u: any) => (u.name ?? "anon") === "x")
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE (COALESCE(t0.name, $1) = $2)");
    expect(params).toEqual(["anon", "x"]);
  });

  it("?? dans une projection", () => {
    const { sql, params } = from<User>("user")
      .select((u: any) => ({ name: u.name ?? "N/A" }))
      .toSql();
    expect(sql).toBe("SELECT COALESCE(t0.name, $1) AS name FROM user AS t0");
    expect(params).toEqual(["N/A"]);
  });
});

describe("SELECT — projection scalaire", () => {
  it("select(u => u.name) → une seule colonne sans AS", () => {
    const { sql, params } = from<User>("user")
      .select((u: any) => u.name)
      .toSql();
    expect(sql).toBe("SELECT t0.name FROM user AS t0");
    expect(params).toEqual([]);
  });

  it("projection scalaire avec expression", () => {
    const { sql, params } = from<User>("user")
      .select((u: any) => u.age + 1)
      .toSql();
    expect(sql).toBe("SELECT (t0.age + $1) FROM user AS t0");
    expect(params).toEqual([1]);
  });
});

describe("SELECT — JOIN multiples (aliasing)", () => {
  type Comment = { id: number; userId: number; body: string };

  it("deux JOIN → t1 puis t2 correctement aliasés", () => {
    const { sql } = from<User>("user")
      .join(from<Post>("post"), (u, p) => u.id === p.userId)
      .join(from<Comment>("comment"), (u, c) => u.id === c.userId)
      .toSql();
    expect(sql).toBe(
      "SELECT * FROM user AS t0" +
        " INNER JOIN post AS t1 ON (t0.id = t1.userId)" +
        " INNER JOIN comment AS t2 ON (t0.id = t2.userId)",
    );
  });

  it("trois JOIN → t1, t2, t3", () => {
    type Tag = { id: number; userId: number };
    const { sql } = from<User>("user")
      .join(from<Post>("post"), (u, p) => u.id === p.userId)
      .join(from<Comment>("comment"), (u, c) => u.id === c.userId)
      .join(from<Tag>("tag"), (u, t) => u.id === t.userId)
      .toSql();
    expect(sql).toContain("INNER JOIN post AS t1 ON (t0.id = t1.userId)");
    expect(sql).toContain("INNER JOIN comment AS t2 ON (t0.id = t2.userId)");
    expect(sql).toContain("INNER JOIN tag AS t3 ON (t0.id = t3.userId)");
  });
});

describe("SELECT — IN", () => {
  it("[].includes(u.id) → IN ($1, $2, $3)", () => {
    const { sql, params } = from<User>("user")
      .filter((u: any) => [1, 2, 3].includes(u.id))
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.id IN ($1, $2, $3)");
    expect(params).toEqual([1, 2, 3]);
  });

  it("[].includes() avec strings", () => {
    const { sql, params } = from<User>("user")
      .filter((u: any) => ["a", "b"].includes(u.name))
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.name IN ($1, $2)");
    expect(params).toEqual(["a", "b"]);
  });

  it("closure array (ConstantExpression) → IN avec params", () => {
    // Simule ce que le compiler AOT produit pour `ids.includes(u.id)`
    const ids = [10, 20, 30];
    const lambda = new LambdaExpression(
      new MethodExpression(new ConstantExpression(ids), "includes", [
        new PropertyExpression(new NameExpression("u"), "id"),
      ]),
      [new NameExpression("u")],
    );
    const { sql, params } = from<User>("user").filter(lambda).toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.id IN ($1, $2, $3)");
    expect(params).toEqual([10, 20, 30]);
  });

  it("closure array vide → 1 = 0", () => {
    const lambda = new LambdaExpression(
      new MethodExpression(new ConstantExpression([]), "includes", [
        new PropertyExpression(new NameExpression("u"), "id"),
      ]),
      [new NameExpression("u")],
    );
    const { sql, params } = from<User>("user").filter(lambda).toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE 1 = 0");
    expect(params).toEqual([]);
  });
});

describe("Sous-requêtes — IN / NOT IN", () => {
  it("whereIn → IN (SELECT ...)", () => {
    type Order = { userId: number; total: number };
    const inner = from<Order>("orders")
      .filter((o) => o.total > 100)
      .select((o: any) => ({ userId: o.userId }));
    const { sql, params } = from<User>("user")
      .whereIn((u) => u.id, inner)
      .toSql();
    expect(sql).toBe(
      "SELECT * FROM user AS t0 WHERE t0.id IN (SELECT t0.userId AS userId FROM orders AS t0 WHERE (t0.total > $1))",
    );
    expect(params).toEqual([100]);
  });

  it("whereNotIn → NOT IN (SELECT ...)", () => {
    type Order = { userId: number };
    const inner = from<Order>("orders").select((o: any) => ({ userId: o.userId }));
    const { sql, params } = from<User>("user")
      .whereNotIn((u) => u.id, inner)
      .toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE t0.id NOT IN (SELECT t0.userId AS userId FROM orders AS t0)");
    expect(params).toEqual([]);
  });

  it("whereIn avec param réindexé", () => {
    type Order = { userId: number; total: number };
    const inner = from<Order>("orders")
      .filter((o) => o.total > 50)
      .select((o: any) => ({ userId: o.userId }));
    const { sql, params } = from<User>("user")
      .filter((u) => u.age > 18)
      .whereIn((u) => u.id, inner)
      .toSql();
    // $1 = 18 (outer), $2 = 50 (inner — réindexé)
    expect(params).toEqual([18, 50]);
    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
  });
});

describe("Sous-requêtes — EXISTS / NOT EXISTS", () => {
  it("whereExists → EXISTS (SELECT ...)", () => {
    type Order = { userId: number };
    const inner = from<Order>("orders").filter((o: any) => o.userId === 1);
    const { sql, params } = from<User>("user").whereExists(inner).toSql();
    expect(sql).toBe("SELECT * FROM user AS t0 WHERE EXISTS (SELECT * FROM orders AS t0 WHERE (t0.userId = $1))");
    expect(params).toEqual([1]);
  });

  it("whereNotExists → NOT EXISTS (SELECT ...)", () => {
    type Order = { userId: number };
    const inner = from<Order>("orders").filter((o: any) => o.userId === 99);
    const { sql, params } = from<User>("user").whereNotExists(inner).toSql();
    expect(sql).toContain("NOT EXISTS");
    expect(params).toEqual([99]);
  });

  it("WHERE + EXISTS combinés", () => {
    type Order = { userId: number };
    const inner = from<Order>("orders").filter((o: any) => o.userId === 5);
    const { sql, params } = from<User>("user")
      .filter((u) => u.active)
      .whereExists(inner)
      .toSql();
    expect(sql).toContain("WHERE t0.active AND EXISTS");
    expect(params).toEqual([5]);
  });
});

describe("UNION", () => {
  it("union basique", () => {
    const q1 = from<User>("user").filter((u) => u.active);
    const q2 = from<User>("user").filter((u) => !u.active);
    const { sql, params } = q1.union(q2).toSql();
    expect(sql).toBe(
      "(SELECT * FROM user AS t0 WHERE t0.active) UNION (SELECT * FROM user AS t0 WHERE NOT (t0.active))",
    );
    expect(params).toEqual([]);
  });

  it("unionAll", () => {
    const q1 = from<User>("user").filter((u) => u.active);
    const q2 = from<User>("user").filter((u) => !u.active);
    const { sql } = q1.unionAll(q2).toSql();
    expect(sql).toContain("UNION ALL");
  });

  it("union avec paramètres réindexés", () => {
    const q1 = from<User>("user").filter((u) => u.age >= 18);
    const q2 = from<User>("user").filter((u) => u.age < 18);
    const { sql, params } = q1.union(q2).toSql();
    expect(sql).toBe(
      "(SELECT * FROM user AS t0 WHERE (t0.age >= $1)) UNION (SELECT * FROM user AS t0 WHERE (t0.age < $2))",
    );
    expect(params).toEqual([18, 18]);
  });
});

describe("INSERT", () => {
  it("insert simple", () => {
    const { sql, params } = insertInto("user", { name: "Kim", age: 30 });
    expect(sql).toBe("INSERT INTO user (name, age) VALUES ($1, $2)");
    expect(params).toEqual(["Kim", 30]);
  });

  it("insert avec boolean", () => {
    const { sql, params } = insertInto("user", { name: "Kim", active: true });
    expect(sql).toBe("INSERT INTO user (name, active) VALUES ($1, $2)");
    expect(params).toEqual(["Kim", true]);
  });
});

describe("UPDATE", () => {
  it("update avec where", () => {
    const { sql, params } = updateIn<User>("user", { active: false }, (u) => u.id === 42);
    expect(sql).toBe("UPDATE user SET active = $1 WHERE (id = $2)");
    expect(params).toEqual([false, 42]);
  });

  it("update sans where", () => {
    const { sql, params } = updateIn("user", { active: true });
    expect(sql).toBe("UPDATE user SET active = $1");
    expect(params).toEqual([true]);
  });
});

describe("DELETE", () => {
  it("delete avec where", () => {
    const { sql, params } = deleteFrom<User>("user", (u) => u.id === 42);
    expect(sql).toBe("DELETE FROM user WHERE (id = $1)");
    expect(params).toEqual([42]);
  });

  it("delete avec condition complexe", () => {
    const { sql, params } = deleteFrom<User>("user", (u) => u.active === false && u.deletedAt !== null);
    expect(sql).toBe("DELETE FROM user WHERE ((active = $1) AND deletedAt IS NOT NULL)");
    expect(params).toEqual([false]);
  });
});

type CamelUser = { id: number; firstName: string; lastName: string; isActive: boolean; createdAt: string | null };

describe("NamingStrategy — snakeCaseNaming", () => {
  it("convertit les propriétés camelCase en snake_case", () => {
    const { sql } = from<CamelUser>("users")
      .filter((u) => u.firstName === "Kim")
      .toSql({ naming: snakeCaseNaming });
    expect(sql).toContain("first_name");
    expect(sql).not.toContain("firstName");
  });

  it("applique le naming dans le ORDER BY", () => {
    const { sql } = from<CamelUser>("users")
      .orderBy((u) => u.createdAt)
      .toSql({ naming: snakeCaseNaming });
    expect(sql).toContain("created_at");
  });

  it("applique le naming dans le SELECT projection", () => {
    const { sql } = from<CamelUser>("users")
      .select((u: any) => ({ firstName: u.firstName, lastName: u.lastName }))
      .toSql({ naming: snakeCaseNaming });
    expect(sql).toContain("t0.first_name AS firstName");
    expect(sql).toContain("t0.last_name AS lastName");
  });

  it("isActive → is_active dans le WHERE", () => {
    const { sql, params } = from<CamelUser>("users")
      .filter((u) => u.isActive)
      .toSql({ naming: snakeCaseNaming });
    expect(sql).toBe("SELECT * FROM users AS t0 WHERE t0.is_active");
    expect(params).toEqual([]);
  });

  it("NULL check avec naming", () => {
    const { sql } = from<CamelUser>("users")
      .filter((u) => u.createdAt === null)
      .toSql({ naming: snakeCaseNaming });
    expect(sql).toContain("created_at IS NULL");
  });

  it("sans naming — comportement identique à identityNaming", () => {
    const { sql: withNaming } = from<User>("user")
      .filter((u) => u.age > 18)
      .toSql({ naming: snakeCaseNaming });
    const { sql: withoutNaming } = from<User>("user")
      .filter((u) => u.age > 18)
      .toSql();
    // 'age' n'a pas de majuscule → snake_case identique
    expect(withNaming).toBe(withoutNaming);
  });
});

describe("Template literals", () => {
  it("template sans interpolation → param unique", () => {
    const { sql, params } = from<User>("user")
      .select((_u: any) => ({ label: `hello` }))
      .toSql();
    expect(sql).toContain("$1 AS label");
    expect(params).toEqual(["hello"]);
  });

  it("template avec une interpolation → || (postgres)", () => {
    const { sql, params } = from<User>("user")
      .select((u: any) => ({ label: `user: ${u.name}` }))
      .toSql();
    expect(sql).toContain("$1 || t0.name AS label");
    expect(params[0]).toBe("user: ");
  });

  it("template → plusieurs interpolations", () => {
    const { sql, params } = from<User>("user")
      .select((u: any) => ({ label: `[${u.id}] ${u.name}` }))
      .toSql();
    expect(sql).toContain("$1 || t0.id || $2 || t0.name AS label");
    expect(params[0]).toBe("[");
    expect(params[1]).toBe("] ");
  });

  it("template dans filter → SQL sécurisé (params, pas injection)", () => {
    const { sql, params } = from<User>("user")
      .filter((u: any) => u.name === `Kim`)
      .toSql();
    expect(sql).toContain("= $1");
    expect(params[0]).toBe("Kim");
  });
});
