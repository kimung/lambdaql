import { describe, it, expect, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import { createPgExecutor } from "../src/index.js";
import { postgres } from "@gamn9/data";

function mockPool() {
  const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
  const client = { query: clientQuery, release: vi.fn() } as unknown as PoolClient;
  const pool = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool;
  return { pool, client, clientQuery };
}

describe("createPgExecutor", () => {
  it("should create an Executor for postgres dialect", () => {
    const { pool } = mockPool();
    const executor = createPgExecutor(pool);
    expect(executor.dialect).toBe(postgres);
  });

  it("should forward query calls to pg Pool and return rows", async () => {
    const mockRows = [{ id: 1, name: "Alice" }];
    const { pool } = mockPool();
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: mockRows });

    const executor = createPgExecutor(pool);
    const result = await executor.query("SELECT * FROM user WHERE id = $1", [1]);

    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM user WHERE id = $1", [1]);
    expect(result).toEqual({ rows: mockRows });
  });
});

describe("createPgExecutor — transaction()", () => {
  it("retourne un TransactionalExecutor", () => {
    const { pool } = mockPool();
    expect(typeof createPgExecutor(pool).transaction).toBe("function");
  });

  it("ordre : BEGIN → query → COMMIT", async () => {
    const { pool, clientQuery } = mockPool();
    const order: string[] = [];
    clientQuery.mockImplementation(async (sql: string) => {
      order.push(sql);
      return { rows: [] };
    });
    await createPgExecutor(pool).transaction(async (exec) => {
      await exec.query("SELECT 1", []);
    });
    expect(order).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
  });

  it("ROLLBACK si le callback lève une erreur", async () => {
    const { pool, clientQuery } = mockPool();
    const order: string[] = [];
    clientQuery.mockImplementation(async (sql: string) => {
      order.push(sql);
      return { rows: [] };
    });
    await expect(
      createPgExecutor(pool).transaction(async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");
    expect(order).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("client.release() est toujours appelé", async () => {
    const { pool, client } = mockPool();
    await expect(
      createPgExecutor(pool).transaction(async () => {
        throw new Error("oops");
      }),
    ).rejects.toThrow();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("les queries passent par client.query, pas pool.query", async () => {
    const { pool, client } = mockPool();
    await createPgExecutor(pool).transaction(async (exec) => {
      await exec.query("SELECT 42", []);
    });
    expect(pool.query).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(3); // BEGIN + SELECT 42 + COMMIT
  });
});
