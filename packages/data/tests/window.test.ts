import { describe, it, expect } from "vitest";
import { from } from "../src/queryable.js";

type Employee = {
  id: number;
  name: string;
  salary: number;
  dept: string;
  region: string;
  hiredAt: string;
};

describe("Window functions — OVER ()", () => {
  it("RANK() OVER (PARTITION BY … ORDER BY …)", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({
        name: e.name,
        rang: e.salary.rank().over({ partitionBy: e.dept, orderBy: e.salary }),
      }))
      .toSql();

    expect(sql).toBe(
      "SELECT t0.name AS name, RANK() OVER (PARTITION BY t0.dept ORDER BY t0.salary ASC) AS rang FROM employee AS t0",
    );
  });

  it("DENSE_RANK() OVER (ORDER BY …)", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({ rang: e.salary.denseRank().over({ orderBy: e.salary }) }))
      .toSql();

    expect(sql).toContain("DENSE_RANK() OVER (ORDER BY t0.salary ASC)");
  });

  it("ROW_NUMBER() OVER (PARTITION BY … ORDER BY … DESC)", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({ rn: e.id.rowNumber().over({ partitionBy: e.dept, orderByDesc: e.salary }) }))
      .toSql();

    expect(sql).toContain("ROW_NUMBER() OVER (PARTITION BY t0.dept ORDER BY t0.salary DESC)");
  });

  it("AVG(col) OVER (PARTITION BY …)", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({ avgSalary: e.salary.avg().over({ partitionBy: e.dept }) }))
      .toSql();

    expect(sql).toContain("AVG(t0.salary) OVER (PARTITION BY t0.dept)");
  });

  it("SUM(col) OVER (ORDER BY …)", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({ cumul: e.salary.sum().over({ orderBy: e.hiredAt }) }))
      .toSql();

    expect(sql).toContain("SUM(t0.salary) OVER (ORDER BY t0.hiredAt ASC)");
  });

  it("COUNT(*) OVER (PARTITION BY …) quand le contexte est le paramètre lambda", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({ total: e.count().over({ partitionBy: e.dept }) }))
      .toSql();

    expect(sql).toContain("COUNT(*) OVER (PARTITION BY t0.dept)");
  });

  it("MAX(col) OVER (PARTITION BY …)", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({ maxSal: e.salary.max().over({ partitionBy: e.dept }) }))
      .toSql();

    expect(sql).toContain("MAX(t0.salary) OVER (PARTITION BY t0.dept)");
  });

  it("PARTITION BY avec plusieurs colonnes (array)", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({
        rang: e.salary.rank().over({ partitionBy: [e.dept, e.region], orderBy: e.salary }),
      }))
      .toSql();

    expect(sql).toContain("PARTITION BY t0.dept, t0.region");
  });

  it("ORDER BY avec plusieurs colonnes (array)", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({ rn: e.id.rowNumber().over({ orderBy: [e.dept, e.salary] }) }))
      .toSql();

    expect(sql).toContain("ORDER BY t0.dept, t0.salary ASC");
  });

  it("OVER () vide (ni partitionBy ni orderBy)", () => {
    const { sql } = from<Employee>("employee")
      .select((e) => ({ rn: e.id.rowNumber().over({}) }))
      .toSql();

    expect(sql).toContain("ROW_NUMBER() OVER ()");
  });

  it("combiné avec WHERE sur la même requête", () => {
    const { sql, params } = from<Employee>("employee")
      .filter((e) => e.dept === "tech")
      .select((e) => ({
        name: e.name,
        rang: e.salary.rank().over({ partitionBy: e.dept, orderBy: e.salary }),
      }))
      .toSql();

    expect(sql).toContain("WHERE (t0.dept = $1)");
    expect(sql).toContain("RANK() OVER (PARTITION BY t0.dept ORDER BY t0.salary ASC)");
    expect(params).toEqual(["tech"]);
  });
});
