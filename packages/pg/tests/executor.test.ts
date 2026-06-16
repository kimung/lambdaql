import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import { createPgExecutor } from "../src/index.js";
import { postgres } from "@gamn9/data";

describe("createPgExecutor", () => {
  it("should create an Executor for postgres dialect", () => {
    const mockPool = {} as Pool;
    const executor = createPgExecutor(mockPool);
    expect(executor.dialect).toBe(postgres);
  });

  it("should forward query calls to pg Pool and return rows", async () => {
    const mockRows = [{ id: 1, name: "Alice" }];
    const mockQuery = vi.fn().mockResolvedValue({ rows: mockRows });
    const mockPool = {
      query: mockQuery,
    } as unknown as Pool;

    const executor = createPgExecutor(mockPool);
    const result = await executor.query("SELECT * FROM user WHERE id = $1", [1]);

    expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM user WHERE id = $1", [1]);
    expect(result).toEqual({ rows: mockRows });
  });
});
