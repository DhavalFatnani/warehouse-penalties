import type { SupabaseClient } from "@supabase/supabase-js";
import { computeLinearAmount, computeTieredAmount } from "@/lib/penalty/calc";

type DefinitionRow = {
  id: string;
  structure_model: string;
  occurrence_scope: string;
  structure_config: Record<string, unknown> | null;
  default_amount: number | null;
};

type TierRow = {
  sort_order: number;
  from_occurrence: number;
  to_occurrence: number | null;
  amount: number | null;
  points: number | null;
};

export async function computePenaltyPayload(
  admin: SupabaseClient,
  input: {
    staff_id: string;
    penalty_definition_id: string;
    incident_date: string;
    computed_amount: number | null | undefined;
    manual_override: boolean | undefined;
    amount_override: boolean | undefined;
  }
) {
  const { data: def, error: defErr } = await admin
    .from("penalty_definitions")
    .select(
      "id, structure_model, occurrence_scope, structure_config, default_amount"
    )
    .eq("id", input.penalty_definition_id)
    .single();

  if (defErr || !def) {
    throw new Error("Penalty definition not found");
  }

  const definition = def as DefinitionRow;

  const { data: tiers } = await admin
    .from("penalty_structure_tiers")
    .select("sort_order, from_occurrence, to_occurrence, amount, points")
    .eq("penalty_definition_id", definition.id)
    .order("sort_order", { ascending: true });

  const tierRows = (tiers ?? []) as TierRow[];

  const useOverride =
    input.amount_override === true ||
    input.manual_override === true ||
    typeof input.computed_amount === "number";

  if (useOverride) {
    const amt =
      input.computed_amount ?? definition.default_amount ?? 0;
    return {
      occurrence_index: 1,
      computed_amount: amt,
      computed_points: null as number | null,
      structure_snapshot: {
        model: "manual_override",
        definition_id: definition.id,
        incident_date: input.incident_date
      },
      manual_override: true
    };
  }

  const { data: occRaw, error: occErr } = await admin.rpc(
    "get_penalty_occurrence_count",
    {
      p_staff_id: input.staff_id,
      p_penalty_definition_id: input.penalty_definition_id,
      p_incident_date: input.incident_date,
      p_occurrence_scope: definition.occurrence_scope,
      p_structure_config: definition.structure_config ?? {}
    }
  );

  if (occErr) throw new Error(occErr.message);

  const prior = Number(occRaw ?? 0);
  const occurrenceIndex = prior + 1;

  let computedAmount: number | null = null;
  let computedPoints: number | null = null;
  const model = definition.structure_model;

  if (model === "fixed_per_occurrence") {
    const base =
      (definition.structure_config as { amount?: number } | null)?.amount ??
      definition.default_amount ??
      null;
    computedAmount = base;
  } else if (model === "tiered_per_occurrence") {
    const r = computeTieredAmount(occurrenceIndex, tierRows);
    computedAmount = r.amount;
    computedPoints = r.points;
  } else if (model === "linear_escalation") {
    const cfg = (definition.structure_config ?? {}) as {
      base_amount?: number;
      step_amount?: number;
      max_amount?: number;
    };
    computedAmount = computeLinearAmount(occurrenceIndex, {
      base_amount: cfg.base_amount ?? 0,
      step_amount: cfg.step_amount ?? 0,
      max_amount: cfg.max_amount
    });
  } else if (model === "bracket_cumulative") {
    const r = computeTieredAmount(occurrenceIndex, tierRows);
    computedAmount = r.amount;
    computedPoints = r.points;
  }

  return {
    occurrence_index: occurrenceIndex,
    computed_amount: computedAmount,
    computed_points: computedPoints,
    structure_snapshot: {
      model: definition.structure_model,
      occurrence_scope: definition.occurrence_scope,
      occurrence_index: occurrenceIndex,
      structure_config: definition.structure_config,
      tiers: tierRows
    },
    manual_override: false
  };
}
