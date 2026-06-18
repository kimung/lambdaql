import { describe, it, expect, vi } from "vitest";
import { from } from "@lambdaql/data";
import { snakeCaseNaming } from "@lambdaql/data";
import { applyQueryable, createNamingFromMikroOrm, LambdaRepository } from "../src/index.js";

type User = { id: number; name: string; age: number; active: boolean; email: string; createdAt: string | null };
type CamelUser = { firstName: string; lastName: string; isActive: boolean; createdAt: string | null };
type UserWithNav = { id: number; name: string; firstName: string; books: { published: boolean; title: string }[] };

function mockQb(alias = "u") {
  return {
    alias,
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };
}

describe("applyQueryable — WHERE", () => {
  it("filter simple → andWhere avec ?", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").filter((u) => u.age > 18),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("(u.age > ?)", [18]);
  });

  it("deux filtres → deux appels andWhere", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users")
        .filter((u) => u.age > 18)
        .filter((u) => u.active),
    );
    expect(qb.andWhere).toHaveBeenCalledTimes(2);
    expect(qb.andWhere).toHaveBeenNthCalledWith(1, "(u.age > ?)", [18]);
    expect(qb.andWhere).toHaveBeenNthCalledWith(2, "u.active", []);
  });

  it("IS NULL", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").filter((u) => u.createdAt === null),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("u.createdAt IS NULL", []);
  });

  it("NOT unaire", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").filter((u) => !u.active),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("NOT (u.active)", []);
  });

  it("AND dans un filtre", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").filter((u) => u.age >= 18 && u.active),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("((u.age >= ?) AND u.active)", [18]);
  });

  it("LIKE (includes)", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").filter((u) => u.email.includes("gmail")),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("u.email LIKE ?", ["%gmail%"]);
  });

  it("IN ([].includes)", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").filter((u: any) => [1, 2, 3].includes(u.id)),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("u.id IN (?, ?, ?)", [1, 2, 3]);
  });
});

describe("applyQueryable — coalesce (??)", () => {
  it("?? → COALESCE avec ?", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").filter((u: any) => (u.name ?? "anon") === "x"),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("(COALESCE(u.name, ?) = ?)", ["anon", "x"]);
  });
});

describe("applyQueryable — ORDER BY / GROUP BY / HAVING", () => {
  it("orderBy → orderBy avec alias", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").orderBy((u) => u.age),
    );
    expect(qb.orderBy).toHaveBeenCalledWith({ "u.age": "ASC" });
  });

  it("orderByDesc → orderBy DESC", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").orderByDesc((u) => u.name),
    );
    expect(qb.orderBy).toHaveBeenCalledWith({ "u.name": "DESC" });
  });

  it("groupBy → groupBy avec alias", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users").groupBy((u) => u.active),
    );
    expect(qb.groupBy).toHaveBeenCalledWith(["u.active"]);
  });

  it("having → having avec ?", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<User>("users")
        .groupBy((u) => u.active)
        .having((u: any) => u.age > 5),
    );
    expect(qb.having).toHaveBeenCalledWith("(u.age > ?)", [5]);
  });
});

describe("applyQueryable — LIMIT / OFFSET", () => {
  it("take → limit", () => {
    const qb = mockQb("u");
    applyQueryable(qb, from<User>("users").take(10));
    expect(qb.limit).toHaveBeenCalledWith(10);
  });

  it("skip → offset", () => {
    const qb = mockQb("u");
    applyQueryable(qb, from<User>("users").skip(20));
    expect(qb.offset).toHaveBeenCalledWith(20);
  });
});

describe("applyQueryable — NamingStrategy", () => {
  it("snakeCaseNaming convertit les colonnes", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<CamelUser>("users").filter((u) => u.isActive),
      { naming: snakeCaseNaming },
    );
    expect(qb.andWhere).toHaveBeenCalledWith("u.is_active", []);
  });

  it("snakeCaseNaming dans orderBy", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<CamelUser>("users").orderBy((u) => u.firstName),
      { naming: snakeCaseNaming },
    );
    expect(qb.orderBy).toHaveBeenCalledWith({ "u.first_name": "ASC" });
  });
});

describe("applyQueryable — alias QB", () => {
  it("respecte l'alias passé à createQueryBuilder", () => {
    const qb = mockQb("author");
    applyQueryable(
      qb,
      from<User>("users").filter((u) => u.age > 18),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("(author.age > ?)", [18]);
  });
});

describe("applyQueryable — sous-requêtes", () => {
  type Order = { userId: number; total: number };

  it("whereIn → IN (SELECT ...) avec ?", () => {
    const qb = mockQb("u");
    const inner = from<Order>("orders")
      .filter((o) => o.total > 50)
      .select((o: any) => ({ userId: o.userId }));
    applyQueryable(
      qb,
      from<User>("users").whereIn((u) => u.id, inner),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining("u.id IN"), expect.arrayContaining([50]));
  });

  it("whereNotIn → NOT IN (SELECT ...)", () => {
    const qb = mockQb("u");
    const inner = from<Order>("orders").select((o: any) => ({ userId: o.userId }));
    applyQueryable(
      qb,
      from<User>("users").whereNotIn((u) => u.id, inner),
    );
    const [cond] = (qb.andWhere as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(cond).toContain("NOT IN");
  });

  it("whereExists → EXISTS (SELECT ...)", () => {
    const qb = mockQb("u");
    const inner = from<Order>("orders").filter((o: any) => o.total > 0);
    applyQueryable(qb, from<User>("users").whereExists(inner));
    const [cond, params] = (qb.andWhere as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(cond).toContain("EXISTS");
    expect(params).toContain(0);
  });

  it("whereNotExists → NOT EXISTS (SELECT ...)", () => {
    const qb = mockQb("u");
    const inner = from<Order>("orders").filter((o: any) => o.userId === 99);
    applyQueryable(qb, from<User>("users").whereNotExists(inner));
    const [cond] = (qb.andWhere as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(cond).toContain("NOT EXISTS");
  });

  it("WHERE + sous-requête combinés → deux appels andWhere", () => {
    const qb = mockQb("u");
    const inner = from<Order>("orders").filter((o: any) => o.total > 0);
    applyQueryable(
      qb,
      from<User>("users")
        .filter((u) => u.active)
        .whereExists(inner),
    );
    expect(qb.andWhere).toHaveBeenCalledTimes(2);
  });
});

describe("applyQueryable — navigation", () => {
  it("u.books.published → books.published (convention)", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<UserWithNav>("users").filter((u) => u.books.published),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("books.published", []);
  });

  it("u.books.published avec alias override → b.published", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<UserWithNav>("users").filter((u) => u.books.published),
      { aliases: { books: "b" } },
    );
    expect(qb.andWhere).toHaveBeenCalledWith("b.published", []);
  });

  it("navigation + naming → books.title converti", () => {
    type UserWithCamelNav = { id: number; books: { isPublished: boolean }[] };
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<UserWithCamelNav>("users").filter((u) => u.books.isPublished),
      { naming: snakeCaseNaming },
    );
    expect(qb.andWhere).toHaveBeenCalledWith("books.is_published", []);
  });

  it("navigation + filtre direct combinés", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<UserWithNav>("users").filter((u) => u.books.published && u.name === "Kim"),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("(books.published AND (u.name = ?))", ["Kim"]);
  });
});

describe("applyQueryable — navigation depth-2", () => {
  type UserDeep = { id: number; company: { id: number; country: { name: string } } };

  it("u.company.country.name → country.name (condition)", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<UserDeep>("users").filter((u: any) => u.company.country.name === "France"),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("(country.name = ?)", ["France"]);
  });

  it("u.company.country.name + alias override country → ctry.name", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<UserDeep>("users").filter((u: any) => u.company.country.name === "France"),
      { aliases: { country: "ctry" } },
    );
    expect(qb.andWhere).toHaveBeenCalledWith("(ctry.name = ?)", ["France"]);
  });
});

describe("applyQueryable — multi-params", () => {
  it("(u, b) => b.published → b.published", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<UserWithNav>("users").filter((u: any, b: any) => b.published),
    );
    expect(qb.andWhere).toHaveBeenCalledWith("b.published", []);
  });

  it("multi-param avec alias override → override appliqué", () => {
    const qb = mockQb("u");
    applyQueryable(
      qb,
      from<UserWithNav>("users").filter((u: any, books: any) => books.published),
      { aliases: { books: "b" } },
    );
    expect(qb.andWhere).toHaveBeenCalledWith("b.published", []);
  });
});

describe("applyQueryable — auto-join via em", () => {
  function mockEm(relations: string[], props: Record<string, { fieldNames: string[] }> = {}) {
    return {
      getMetadata: () => ({
        get: (_entity: any) => ({ relations: relations.map((name) => ({ name })), props }),
      }),
      config: {
        getNamingStrategy: () => ({
          propertyToColumnName: (p: string) => p.replace(/([A-Z])/g, "_$1").toLowerCase(),
        }),
      },
    } as any;
  }

  it("ajoute leftJoin pour les propriétés de navigation qui sont des relations", () => {
    const qb = mockQb("u");
    const em = mockEm(["books"]);
    applyQueryable(
      qb,
      from<UserWithNav>("users").filter((u) => u.books.published),
      { em, entity: class User {} as any },
    );
    expect(qb.leftJoin).toHaveBeenCalledWith("u.books", "books");
    expect(qb.andWhere).toHaveBeenCalledWith("books.published", []);
  });

  it("leftJoin avant andWhere", () => {
    const qb = mockQb("u");
    const em = mockEm(["books"]);
    const callOrder: string[] = [];
    qb.leftJoin.mockImplementation((..._args: any[]) => {
      callOrder.push("leftJoin");
      return qb;
    });
    qb.andWhere.mockImplementation((..._args: any[]) => {
      callOrder.push("andWhere");
      return qb;
    });

    applyQueryable(
      qb,
      from<UserWithNav>("users").filter((u) => u.books.published),
      { em, entity: class User {} as any },
    );
    expect(callOrder).toEqual(["leftJoin", "andWhere"]);
  });

  it("n'ajoute pas leftJoin pour une propriété simple (non-relation)", () => {
    const qb = mockQb("u");
    // books n'est pas dans les relations → pas de join
    const em = mockEm([]);
    applyQueryable(
      qb,
      from<UserWithNav>("users").filter((u) => u.books.published),
      { em, entity: class User {} as any },
    );
    expect(qb.leftJoin).not.toHaveBeenCalled();
  });

  it("auto-join respecte aliasOverrides", () => {
    const qb = mockQb("u");
    const em = mockEm(["books"]);
    applyQueryable(
      qb,
      from<UserWithNav>("users").filter((u) => u.books.published),
      { em, entity: class User {} as any, aliases: { books: "b" } },
    );
    expect(qb.leftJoin).toHaveBeenCalledWith("u.books", "b");
    expect(qb.andWhere).toHaveBeenCalledWith("b.published", []);
  });

  it("em dérive le naming depuis NamingStrategy MikroORM", () => {
    const qb = mockQb("u");
    const em = mockEm([], { firstName: { fieldNames: [] } });
    applyQueryable(
      qb,
      from<CamelUser>("users").filter((u) => u.firstName === "Kim"),
      { em, entity: class User {} as any },
    );
    expect(qb.andWhere).toHaveBeenCalledWith("(u.first_name = ?)", ["Kim"]);
  });

  it("auto-join depth-2 : u.company.country.name → leftJoin company puis leftJoin country", () => {
    const qb = mockQb("u");
    // entityMeta User a une relation 'company' avec targetMeta qui a une relation 'country'
    const countryMeta = { relations: [] };
    const companyMeta = { relations: [{ name: "country", targetMeta: countryMeta }] };
    const em = {
      getMetadata: () => ({
        get: () => ({ relations: [{ name: "company", targetMeta: companyMeta }], props: {} }),
      }),
      config: { getNamingStrategy: () => ({ propertyToColumnName: (p: string) => p }) },
    } as any;

    applyQueryable(
      qb,
      from<any>("users").filter((u: any) => u.company.country.name === "France"),
      { em, entity: "User" as any },
    );
    expect(qb.leftJoin).toHaveBeenNthCalledWith(1, "u.company", "company");
    expect(qb.leftJoin).toHaveBeenNthCalledWith(2, "company.country", "country");
    expect(qb.andWhere).toHaveBeenCalledWith("(country.name = ?)", ["France"]);
  });

  it("auto-join stoppe si segment intermédiaire n'est pas une relation", () => {
    const qb = mockQb("u");
    // 'company' n'est pas dans les relations → aucun join
    const em = {
      getMetadata: () => ({
        get: () => ({ relations: [], props: {} }),
      }),
      config: { getNamingStrategy: () => ({ propertyToColumnName: (p: string) => p }) },
    } as any;

    applyQueryable(
      qb,
      from<any>("users").filter((u: any) => u.company.country.name === "France"),
      { em, entity: "User" as any },
    );
    expect(qb.leftJoin).not.toHaveBeenCalled();
  });

  it("em + fieldName explicite prioritaire sur NamingStrategy", () => {
    const qb = mockQb("u");
    const em = mockEm([], { firstName: { fieldNames: ["prenom"] } });
    applyQueryable(
      qb,
      from<CamelUser>("users").filter((u) => u.firstName === "Kim"),
      { em, entity: class User {} as any },
    );
    expect(qb.andWhere).toHaveBeenCalledWith("(u.prenom = ?)", ["Kim"]);
  });
});

describe("createNamingFromMikroOrm", () => {
  it("utilise propertyToColumnName depuis la NamingStrategy MikroORM", () => {
    const orm = {
      config: {
        getNamingStrategy: () => ({
          propertyToColumnName: (p: string) => p.replace(/([A-Z])/g, "_$1").toLowerCase(),
        }),
      },
    } as any;
    const naming = createNamingFromMikroOrm(orm);
    expect(naming("firstName")).toBe("first_name");
    expect(naming("isActive")).toBe("is_active");
    expect(naming("id")).toBe("id");
  });

  it("priorité au fieldName explicite sur @Property({ fieldName })", () => {
    const orm = {
      config: {
        getNamingStrategy: () => ({
          propertyToColumnName: (p: string) => p.replace(/([A-Z])/g, "_$1").toLowerCase(),
        }),
      },
    } as any;
    const entityMeta = { props: { firstName: { fieldNames: ["prenom"] } } };
    const naming = createNamingFromMikroOrm(orm, entityMeta);
    expect(naming("firstName")).toBe("prenom"); // override
    expect(naming("isActive")).toBe("is_active"); // NamingStrategy
  });
});

describe("LambdaRepository", () => {
  type SimpleUser = { id: number; age: number; active: boolean };

  function mockEmForRepo(tableName = "users") {
    const qb = {
      alias: "t0",
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      join: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      getResultList: vi.fn().mockResolvedValue([]),
    };
    const em = {
      getMetadata: () => ({ get: () => ({ tableName, props: {} }) }),
      config: { getNamingStrategy: () => ({ propertyToColumnName: (p: string) => p }) },
      getOrm: () => ({ config: { getNamingStrategy: () => ({ propertyToColumnName: (p: string) => p }) } }),
      createQueryBuilder: vi.fn().mockReturnValue(qb),
    } as any;
    return { em, qb };
  }

  it("findWhere applique le prédicat via applyQueryable", async () => {
    const { em, qb } = mockEmForRepo();

    class UserRepo extends LambdaRepository<SimpleUser> {}
    const repo = new (UserRepo as any)(em, "SimpleUser");

    await repo.findWhere((u: SimpleUser) => u.age > 18);

    expect(em.createQueryBuilder).toHaveBeenCalledWith("SimpleUser", "t0");
    expect(qb.andWhere).toHaveBeenCalledWith("(t0.age > ?)", [18]);
    expect(qb.getResultList).toHaveBeenCalled();
  });

  it("findWhere avec build callback ajoute limit/offset", async () => {
    const { em, qb } = mockEmForRepo();

    class UserRepo extends LambdaRepository<SimpleUser> {}
    const repo = new (UserRepo as any)(em, "SimpleUser");

    await repo.findWhere(
      (u: SimpleUser) => u.active === true,
      (q: any) => q.skip(10).take(5),
    );

    expect(qb.offset).toHaveBeenCalledWith(10);
    expect(qb.limit).toHaveBeenCalledWith(5);
  });

  it("queryable dérive le nom de table depuis les métadonnées", async () => {
    const { em, qb } = mockEmForRepo("my_users");

    class UserRepo extends LambdaRepository<SimpleUser> {}
    const repo = new (UserRepo as any)(em, "SimpleUser");

    await repo.findWhere((u: SimpleUser) => u.age > 0);

    // andWhere doit référencer l'alias t0, pas le nom de table — la table est résolue correctement
    expect(qb.andWhere).toHaveBeenCalledWith("(t0.age > ?)", [0]);
  });
});

describe("applyQueryable — erreurs", () => {
  it("rejette les UnionExpression", () => {
    const qb = mockQb();
    const q = from<User>("u").union(from<User>("u"));
    expect(() => applyQueryable(qb, q)).toThrow("@lambdaql/mikro-orm");
  });

  it("ignore les joins lambdaql sans erreur", () => {
    const qb = mockQb();
    const q = from<User>("u").join("other", from<User>("other"), (a, b) => a.id === b.id);
    expect(() => applyQueryable(qb, q)).not.toThrow();
  });
});
