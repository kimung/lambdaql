import Database from 'better-sqlite3'
import { createSqliteExecutor } from '@gamn9/sqlite'
import {
  createDatabase, insertInto, updateIn, deleteFrom,
  snakeCaseNaming, sqlite as sqliteDialect,
} from '@gamn9/data'

// ── Schéma ────────────────────────────────────────────────────────────────────

type Department = { id: number; name: string }
type Employee   = { id: number; name: string; age: number; salary: number; departmentId: number }

// ── Setup ─────────────────────────────────────────────────────────────────────

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE department (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE employee (
    id            INTEGER PRIMARY KEY,
    name          TEXT    NOT NULL,
    age           INTEGER NOT NULL,
    salary        REAL    NOT NULL,
    department_id INTEGER REFERENCES department(id)
  );
`)

const dmlOpts = { dialect: sqliteDialect }
const naming  = snakeCaseNaming

// Insertions via helper DML — les clés doivent correspondre aux colonnes DB
const depts = [{ id: 1, name: 'Engineering' }, { id: 2, name: 'Marketing' }]
for (const d of depts) {
  const { sql, params } = insertInto('department', d, dmlOpts)
  db.prepare(sql).run(params)
}

// Pour les employés : mapper camelCase → snake_case pour le DML
const employees: Employee[] = [
  { id: 1, name: 'Alice',   age: 30, salary: 90000, departmentId: 1 },
  { id: 2, name: 'Bob',     age: 25, salary: 65000, departmentId: 2 },
  { id: 3, name: 'Charlie', age: 35, salary: 95000, departmentId: 1 },
  { id: 4, name: 'Diana',   age: 28, salary: 72000, departmentId: 1 },
]
for (const { id, name, age, salary, departmentId } of employees) {
  const { sql, params } = insertInto('employee', { id, name, age, salary, department_id: departmentId }, dmlOpts)
  db.prepare(sql).run(params)
}

// ── Requêtes (snakeCaseNaming : departmentId → department_id) ─────────────────

const executor = createSqliteExecutor(db)
const q        = createDatabase(executor, { naming })

// 1. Employés du département 1, triés par salaire décroissant
const engineers = await q.from<Employee>('employee')
  .filter(e => e.departmentId === 1)
  .orderByDesc(e => e.salary)
  .toArray()

console.log('Engineering:', engineers.map(e => `${e.name} — $${e.salary}`))

// 2. Nombre d'employés de plus de 27 ans
const seniorCount = await q.from<Employee>('employee').filter(e => e.age > 27).count()
console.log('Age > 27:', seniorCount)

// 3. Meilleur salaire
const topEarner = await q.from<Employee>('employee').orderByDesc(e => e.salary).first()
console.log('Top earner:', topEarner.name, `$${topEarner.salary}`)

// 4. Projection partielle
const summary = await q.from<Employee>('employee')
  .select(e => ({ name: e.name, salary: e.salary }))
  .orderBy(e => e.name)
  .toArray()
console.log('Summary:', summary)

// 5. JOIN avec le nom du département
const withDept = await q.from<Employee & { deptName: string }>('employee')
  .join(q.from<Department>('department'), (e: any, d: any) => e.departmentId === d.id)
  .select((e: any, d: any) => ({ name: e.name, dept: d.name }))
  .toArray()
console.log('With dept:', withDept)

// 6. Mise à jour DML (Alice passe à 100 000)
const { sql: updSql, params: updParams } =
  updateIn('employee', { salary: 100000 }, (e: any) => e.id === 1, dmlOpts)
db.prepare(updSql).run(updParams)

// 7. Suppression DML (< 26 ans)
const { sql: delSql, params: delParams } =
  deleteFrom('employee', (e: any) => e.age < 26, dmlOpts)
db.prepare(delSql).run(delParams)

const remaining = await q.from<Employee>('employee').count()
console.log(`Remaining after DML: ${remaining}`)
