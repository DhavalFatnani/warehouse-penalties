import { describe, expect, it } from "vitest";
import { buildRecordVisibilityOrFilter } from "@/lib/query-scope";

describe("record visibility filter builder", () => {
  it("returns null when no scope ids", () => {
    expect(buildRecordVisibilityOrFilter([], ["s1"])).toBeNull();
    expect(buildRecordVisibilityOrFilter(["w1"], [])).toBeNull();
  });

  it("builds a warehouse + null-warehouse staff filter", () => {
    const filter = buildRecordVisibilityOrFilter(["w1", "w2"], ["s1", "s2"]);
    expect(filter).toBe(
      "warehouse_id.in.(w1,w2),and(warehouse_id.is.null,staff_id.in.(s1,s2))"
    );
  });
});
