type Tier = {
  from_occurrence: number;
  to_occurrence: number | null;
  amount: number | null;
  points: number | null;
};

type LinearConfig = {
  base_amount: number;
  step_amount: number;
  max_amount?: number;
};

export function computeTieredAmount(occurrenceIndex: number, tiers: Tier[]) {
  const tier = tiers.find(
    (t) =>
      occurrenceIndex >= t.from_occurrence &&
      (t.to_occurrence === null || occurrenceIndex <= t.to_occurrence)
  );
  if (!tier) return { amount: null, points: null };
  return { amount: tier.amount, points: tier.points };
}

export function computeLinearAmount(
  occurrenceIndex: number,
  config: LinearConfig
) {
  const raw = config.base_amount + Math.max(occurrenceIndex - 1, 0) * config.step_amount;
  if (typeof config.max_amount === "number") {
    return Math.min(raw, config.max_amount);
  }
  return raw;
}
