import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/http";

export async function replacePenaltyDefinitionStaffTypes(
  client: SupabaseClient,
  penaltyDefinitionId: string,
  staffTypeIds: string[]
) {
  const { error: delErr } = await client
    .from("penalty_definition_staff_types")
    .delete()
    .eq("penalty_definition_id", penaltyDefinitionId);
  if (delErr) throw new Error(delErr.message);

  if (staffTypeIds.length === 0) return;

  const rows = staffTypeIds.map((staff_type_id) => ({
    penalty_definition_id: penaltyDefinitionId,
    staff_type_id
  }));
  const { error: insErr } = await client
    .from("penalty_definition_staff_types")
    .insert(rows);
  if (insErr) throw new Error(insErr.message);
}

export async function getStaffTypeIdsForDefinition(
  client: SupabaseClient,
  penaltyDefinitionId: string
): Promise<string[]> {
  const { data, error } = await client
    .from("penalty_definition_staff_types")
    .select("staff_type_id")
    .eq("penalty_definition_id", penaltyDefinitionId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.staff_type_id as string);
}

/**
 * Ensures the staff member's type is allowed for this penalty definition.
 */
export async function assertPenaltyAppliesToStaffType(
  staffId: string,
  penaltyDefinitionId: string
) {
  const { data: staff, error: sErr } = await adminClient
    .from("staff")
    .select("staff_type_id")
    .eq("id", staffId)
    .single();
  if (sErr || !staff) {
    throw new HttpError("NOT_FOUND", "Staff not found", 404);
  }

  const allowed = await getStaffTypeIdsForDefinition(
    adminClient,
    penaltyDefinitionId
  );

  if (allowed.length === 0) {
    throw new HttpError(
      "INVALID_DEFINITION",
      "This penalty has no staff types assigned. Edit the definition and select at least one.",
      400
    );
  }

  if (!allowed.includes(staff.staff_type_id)) {
    throw new HttpError(
      "STAFF_TYPE_MISMATCH",
      "This penalty does not apply to this staff member's role type.",
      400
    );
  }
}
