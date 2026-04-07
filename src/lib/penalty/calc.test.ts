import { describe, expect, it } from "vitest";
import { computeLinearAmount, computeTieredAmount } from "@/lib/penalty/calc";

describe("penalty calculation", () => {
  it("computes tiered amount", () => {
    const res1 = computeTieredAmount(1, [
      { from_occurrence: 1, to_occurrence: 1, amount: 150, points: null },
      { from_occurrence: 2, to_occurrence: 2, amount: 250, points: null },
      { from_occurrence: 3, to_occurrence: null, amount: 400, points: null }
    ]);
    const res3 = computeTieredAmount(3, [
      { from_occurrence: 1, to_occurrence: 1, amount: 150, points: null },
      { from_occurrence: 2, to_occurrence: 2, amount: 250, points: null },
      { from_occurrence: 3, to_occurrence: null, amount: 400, points: null }
    ]);
    expect(res1.amount).toBe(150);
    expect(res3.amount).toBe(400);
  });

  it("computes linear amount with max", () => {
    const value = computeLinearAmount(10, {
      base_amount: 50,
      step_amount: 25,
      max_amount: 200
    });
    expect(value).toBe(200);
  });
});
