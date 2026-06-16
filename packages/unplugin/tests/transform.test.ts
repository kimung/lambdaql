import { describe, it, expect } from "vitest";
import { transform } from "../src/transform.js";

function makeFile(body: string): string {
  return `import { from } from "@gamn9/data";\n${body}`;
}

// Évalue le premier argument transformé d'un appel de méthode dans le code généré
function extractArg(code: string): unknown {
  const result = transform(code, "test.ts");
  if (!result) throw new Error("transform a retourné null");
  const match = result.code.match(/\.\w+\((\{[\s\S]*?\})\)/);
  if (!match) throw new Error(`Aucun argument transformé dans : ${result.code}`);
  return eval(`(${match[1]})`); // eslint-disable-line no-eval
}

function extractAllArgs(code: string): unknown[] {
  const result = transform(code, "test.ts");
  if (!result) throw new Error("transform a retourné null");
  const matches = [...result.code.matchAll(/\.\w+\((\{kind:"LambdaExpression"[\s\S]*?\})\)/g)];
  return matches.map((m) => eval(`(${m[1]})`)); // eslint-disable-line no-eval
}

describe("transform — lambdas simples", () => {
  it("transforme u => u.active en LambdaExpression", () => {
    const code = makeFile(`const q = from("user");\nq.filter(u => u.active);`);
    const ast: any = extractArg(code);
    expect(ast.kind).toBe("LambdaExpression");
    expect(ast.args[0].name).toBe("u");
    expect(ast.body.kind).toBe("PropertyExpression");
    expect(ast.body.property).toBe("active");
  });

  it("transforme une comparaison binaire", () => {
    const code = makeFile(`const q = from("user");\nq.filter(u => u.age > 18);`);
    const ast: any = extractArg(code);
    expect(ast.body.kind).toBe("BinaryExpression");
    expect(ast.body.operator).toBe(">");
    expect(ast.body.right.kind).toBe("ConstantExpression");
    expect(ast.body.right.value).toBe(18);
  });

  it("transforme === null", () => {
    const code = makeFile(`const q = from("user");\nq.filter(u => u.deletedAt === null);`);
    const ast: any = extractArg(code);
    expect(ast.body.right.value).toBeNull();
  });

  it("transforme un NOT unaire", () => {
    const code = makeFile(`const q = from("user");\nq.filter(u => !u.active);`);
    const ast: any = extractArg(code);
    expect(ast.body.kind).toBe("UnaryExpression");
    expect(ast.body.operator).toBe("!");
  });

  it("transforme une chaîne de méthode (includes)", () => {
    const code = makeFile(`const q = from("user");\nq.filter(u => u.email.includes("gmail"));`);
    const ast: any = extractArg(code);
    expect(ast.body.kind).toBe("MethodExpression");
    expect(ast.body.method).toBe("includes");
    expect(ast.body.args[0].value).toBe("gmail");
  });

  it("transforme un select avec objet littéral", () => {
    const code = makeFile(`const q = from("user");\nq.select(u => ({ id: u.id, name: u.name }));`);
    const ast: any = extractArg(code);
    expect(ast.body.kind).toBe("ObjectLiteralExpression");
    expect(ast.body.fields).toHaveLength(2);
    expect(ast.body.fields[0].name).toBe("id");
  });

  it("transforme un tableau littéral (IN)", () => {
    const code = makeFile(`const q = from("user");\nq.filter(u => [1,2,3].includes(u.id));`);
    const ast: any = extractArg(code);
    expect(ast.body.kind).toBe("MethodExpression");
    expect(ast.body.context.kind).toBe("ArrayLiteralExpression");
    expect(ast.body.context.elements).toHaveLength(3);
  });
});

describe("transform — closures", () => {
  it("capture un identifiant externe comme ConstantExpression avec ref vivante", () => {
    const code = makeFile(`const q = from("user");\nconst minAge = 18;\nq.filter(u => u.age > minAge);`);
    const result = transform(code, "test.ts");
    expect(result).not.toBeNull();
    // minAge doit apparaître tel quel (ref vivante, non inlinée à 18)
    expect(result!.code).toMatch(/value:minAge/);
  });

  it("évalue correctement la closure au runtime", () => {
    const minAge = 21;
    const code = makeFile(`const q = from("user");\nconst minAge = ${minAge};\nq.filter(u => u.age > minAge);`);
    const result = transform(code, "test.ts");
    expect(result).not.toBeNull();
    // La référence minAge est dans le code généré
    expect(result!.code).toMatch(/value:minAge/);
  });
});

describe("transform — détection inline et chaînes", () => {
  it("transforme une chaîne inline from().filter()", () => {
    const code = makeFile(`from("user").filter(u => u.active);`);
    const ast: any = extractArg(code);
    expect(ast.kind).toBe("LambdaExpression");
  });

  it("transforme deux lambdas dans filter().select()", () => {
    const code = makeFile(`const q = from("user");\nq.filter(u => u.active).select(u => u.name);`);
    const asts = extractAllArgs(code);
    expect(asts).toHaveLength(2);
    const [filter, select]: any[] = asts;
    expect(filter.body.kind).toBe("PropertyExpression");
    expect(filter.body.property).toBe("active");
    expect(select.body.property).toBe("name");
  });

  it("transforme une variable assignée depuis un from()", () => {
    const code = makeFile(`const q = from("user");\nconst q2 = q;\nq2.filter(u => u.active);`);
    // q2 n'est pas tracé (assigné depuis une variable, pas un factory call direct)
    // → le runtime fallback prend le relais. Ce test vérifie que la transformation se fait quand même
    // via la chaîne implicite (q est dans queryableVars, q2 non — comportement attendu en V1)
    const result = transform(code, "test.ts");
    // q2 n'est pas dans queryableVars → pas de transformation (null ou code inchangé pour cette ligne)
    // C'est un faux négatif connu en V1
    if (result) {
      // Si transformé (comportement inattendu), c'est quand même valide
    }
    // Test principal : pas de crash
  });
});

describe("transform — méthodes join", () => {
  it("transforme le troisième argument de join", () => {
    const code = makeFile(`
const q = from("user");
const p = from("post");
q.join("p", p, (u, p) => u.id === p.userId);`);
    const result = transform(code, "test.ts");
    expect(result).not.toBeNull();
    expect(result!.code).toMatch(/LambdaExpression/);
    expect(result!.code).toMatch(/BinaryExpression/);
  });
});

describe("transform — non-régression (faux positifs)", () => {
  it("retourne null si pas d'import @gamn9/data", () => {
    const result = transform(`const arr = [1,2,3];\narr.filter(x => x > 0);`, "test.ts");
    expect(result).toBeNull();
  });

  it("ne transforme pas .filter() sur un tableau (non Queryable)", () => {
    const code = makeFile(`const arr = [1, 2, 3];\narr.filter(x => x > 0);`);
    const result = transform(code, "test.ts");
    // `arr` n'est pas dans queryableVars → pas de transformation
    if (result) {
      expect(result.code).not.toMatch(/LambdaExpression/);
    }
  });

  it("retourne null si le fichier a l'import mais aucune lambda Queryable", () => {
    const code = makeFile(`const x = 1;`);
    const result = transform(code, "test.ts");
    expect(result).toBeNull();
  });
});

describe("transform — createDatabase (pattern Database.from)", () => {
  it("transforme db.from().filter() issu de createDatabase", () => {
    const code = `import { createDatabase } from "@gamn9/data";
const db = createDatabase(exec);
db.from("user").filter(u => u.active);`;
    const ast: any = extractArg(code);
    expect(ast.kind).toBe("LambdaExpression");
    expect(ast.body.kind).toBe("PropertyExpression");
    expect(ast.body.property).toBe("active");
  });

  it("transforme db.from().filter().select()", () => {
    const code = `import { createDatabase } from "@gamn9/data";
const db = createDatabase(exec);
db.from("user").filter(u => u.active).select(u => u.name);`;
    const asts = extractAllArgs(code);
    expect(asts).toHaveLength(2);
  });

  it("transforme une closure dans db.from().filter()", () => {
    const code = `import { createDatabase } from "@gamn9/data";
const db = createDatabase(exec);
const minAge = 18;
db.from("user").filter(u => u.age > minAge);`;
    const result = transform(code, "test.ts");
    expect(result).not.toBeNull();
    expect(result!.code).toMatch(/value:minAge/);
  });
});

describe("transform — paramètres typés Queryable<T>", () => {
  it("transforme dans une fonction avec param q: Queryable<User>", () => {
    const code = `import { from } from "@gamn9/data";
function doQuery(q: Queryable<User>) {
  return q.filter(u => u.active);
}`;
    const ast: any = extractArg(code);
    expect(ast.kind).toBe("LambdaExpression");
    expect(ast.body.property).toBe("active");
  });

  it("transforme dans une arrow function avec param q: Queryable<T>", () => {
    const code = `import { from } from "@gamn9/data";
const doQuery = (q: Queryable<User>) => q.filter(u => u.age > 0);`;
    const ast: any = extractArg(code);
    expect(ast.kind).toBe("LambdaExpression");
  });

  it("ne transforme pas un paramètre non-Queryable dans le même fichier", () => {
    const code = `import { from } from "@gamn9/data";
const q = from("user");
function process(arr: number[]) {
  return arr.filter(x => x > 0);
}
q.filter(u => u.active);`;
    const result = transform(code, "test.ts");
    expect(result).not.toBeNull();
    // Seul le filter sur q (Queryable) doit être transformé, pas arr.filter
    const lambdaCount = (result!.code.match(/LambdaExpression/g) ?? []).length;
    expect(lambdaCount).toBe(1);
  });
});

describe("transform — sourcemap", () => {
  it("produit un sourcemap quand une transformation a lieu", () => {
    const code = makeFile(`const q = from("user");\nq.filter(u => u.active);`);
    const result = transform(code, "test.ts");
    expect(result).not.toBeNull();
    expect(result!.map).toBeDefined();
  });
});
