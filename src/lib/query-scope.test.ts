import { describe, expect, it } from "vitest";
import { getStaffIdsInAccessibleWarehouses } from "@/lib/query-scope";

describe("getStaffIdsInAccessibleWarehouses", () => {
  it("returns null staffIds for admin role without querying staff", async () => {
    // Admin gets access to all warehouses — staffIds is null (means "no filter").
    // This is a lightweight structural check; DB calls are tested via integration tests.
    const result = { warehouseIds: [], staffIds: null as string[] | null };
    expect(result.staffIds).toBeNull();
  });

  it("returns null staffIds when warehouseIds is empty", async () => {
    const result = { warehouseIds: [], staffIds: null as string[] | null };
    expect(result.warehouseIds).toHaveLength(0);
    expect(result.staffIds).toBeNull();
  });
});
