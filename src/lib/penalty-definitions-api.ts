import { replacePenaltyDefinitionStaffTypes } from "@/lib/penalty-definition-staff-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PENALTY_DEFINITION_SELECT = `
  *,
  penalty_definition_staff_types (
    staff_type_id,
    staff_types ( id, code, display_name )
  )
`;

export type PenaltyDefinitionRow = Record<string, unknown>;

export function normalizePenaltyDefinition(row: PenaltyDefinitionRow) {
  const links =
    (row.penalty_definition_staff_types as
      | { staff_type_id: string; staff_types: { id: string; code: string; display_name: string } | null }[]
      | undefined) ?? [];
  const staff_type_ids = links.map((l) => l.staff_type_id);
  const staff_types = links
    .map((l) => l.staff_types)
    .filter((s): s is { id: string; code: string; display_name: string } => s != null);
  const { penalty_definition_staff_types: _p, ...rest } = row;
  return {
    ...rest,
    staff_type_ids,
    staff_types
  };
}

export async function insertPenaltyDefinitionWithStaffTypes(
  client: SupabaseClient,
  payload: Record<string, unknown>,
  staffTypeIds: string[],
  createdByUserId: string
) {
  const { data, error } = await client
    .from("penalty_definitions")
    .insert({ ...payload, created_by_user_id: createdByUserId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await replacePenaltyDefinitionStaffTypes(client, data.id as string, staffTypeIds);

  const { data: full, error: fullErr } = await client
    .from("penalty_definitions")
    .select(PENALTY_DEFINITION_SELECT)
    .eq("id", data.id)
    .single();
  if (fullErr) throw new Error(fullErr.message);
  return normalizePenaltyDefinition(full as PenaltyDefinitionRow);
}
