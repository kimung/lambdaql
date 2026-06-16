/**
 * Exemple AOT — @gamn9/compiler avec ts-patch
 *
 * Prérequis :
 *   npm install          (installe ts-patch)
 *   npm run prepare      (ts-patch install — patche TypeScript une seule fois)
 *   npm start            (tsc + node dist/index.js)
 *
 * Le transformer @gamn9/compiler remplace les arrow functions passées à
 * filter/select/orderBy par leur AST @gamn9/expression à la compilation,
 * éliminant le parsing runtime (fn.toString() → Lexer → Parser).
 * Le bénéfice est mesurable sur les requêtes exécutées en boucle serrée.
 */
import Database from "better-sqlite3";
import { createSqliteExecutor } from "@gamn9/sqlite";
import { createDatabase, snakeCaseNaming } from "@gamn9/data";

type Product = { id: number; name: string; price: number; stock: number; categoryId: number };

const db = new Database(":memory:");
db.exec(`
  CREATE TABLE product (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    price       REAL    NOT NULL,
    stock       INTEGER NOT NULL,
    category_id INTEGER NOT NULL
  );
  INSERT INTO product VALUES (1, 'Laptop',  999.99, 10, 1);
  INSERT INTO product VALUES (2, 'Phone',   499.99, 25, 1);
  INSERT INTO product VALUES (3, 'Desk',    299.99,  5, 2);
  INSERT INTO product VALUES (4, 'Chair',   199.99,  8, 2);
  INSERT INTO product VALUES (5, 'Monitor', 349.99, 15, 1);
`);

const q = createDatabase(createSqliteExecutor(db), { naming: snakeCaseNaming });

// Ces lambdas sont remplacées par leur AST à la compilation — aucun parsing runtime
const expensive = await q
  .from<Product>("product")
  .filter((p) => p.price > 300)
  .orderByDesc((p) => p.price)
  .toArray();

console.log("Products > $300:");
expensive.forEach((p) => console.log(` ${p.name.padEnd(10)} $${p.price}`));

const electronics = await q
  .from<Product>("product")
  .filter((p) => p.categoryId === 1)
  .select((p) => ({ name: p.name, price: p.price }))
  .orderBy((p) => p.name)
  .toArray();

console.log("\nElectronics:");
electronics.forEach((p) => console.log(` ${p.name} — $${p.price}`));

const lowStock = await q
  .from<Product>("product")
  .filter((p) => p.stock < 10)
  .count();

console.log(`\nLow-stock products: ${lowStock}`);
