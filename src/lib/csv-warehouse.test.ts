import { describe, expect, it } from "vitest";
import { resolveWarehouseForImportRow } from "./csv-warehouse";

const acc = new Set(["11111111-1111-1111-1111-111111111111"]);
const codeToId = new Map([
  ["WH1", "11111111-1111-1111-1111-111111111111"],
  ["WH2", "22222222-2222-2222-2222-222222222222"]
]);

describe("resolveWarehouseForImportRow", () => {
  it("uses default when columns absent", () => {
    const r = resolveWarehouseForImportRow({
      row: {},
      defaultWarehouseId: "11111111-1111-1111-1111-111111111111",
      codeToId,
      accessibleIds: acc
    });
    expect(r).toEqual({
      ok: true,
      warehouse_id: "11111111-1111-1111-1111-111111111111"
    });
  });

  it("resolves warehouse_code", () => {
    const r = resolveWarehouseForImportRow({
      row: { warehouse_code: "wh1" },
      defaultWarehouseId: null,
      codeToId,
      accessibleIds: new Set([
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222"
      ])
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warehouse_id).toBe("11111111-1111-1111-1111-111111111111");
    }
  });

  it("rejects both id and code", () => {
    const r = resolveWarehouseForImportRow({
      row: {
        warehouse_id: "11111111-1111-1111-1111-111111111111",
        warehouse_code: "WH1"
      },
      defaultWarehouseId: null,
      codeToId,
      accessibleIds: acc
    });
    expect(r.ok).toBe(false);
  });

  it("requires default or column", () => {
    const r = resolveWarehouseForImportRow({
      row: {},
      defaultWarehouseId: null,
      codeToId,
      accessibleIds: acc
    });
    expect(r.ok).toBe(false);
  });
});
