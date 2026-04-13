import { adminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/auth";
import { assertPenaltyAppliesToStaffType } from "@/lib/penalty-definition-staff-types";
import { computePenaltyPayload } from "@/lib/penalty/apply-server";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { HttpError } from "@/lib/http";
import type { PenaltyRecordCreateParsed } from "@/lib/validators";

export async function insertPenaltyRecord(
  appUser: { id: string; role: AppRole },
  parsed: PenaltyRecordCreateParsed
) {
  const { data: staffRow, error: staffErr } = await adminClient
    .from("staff")
    .select("warehouse_id")
    .eq("id", parsed.staff_id)
    .single();

  if (staffErr || !staffRow) {
    throw new Error("Staff not found");
  }

  if (parsed.warehouse_id && parsed.warehouse_id !== staffRow.warehouse_id) {
    throw new HttpError(
      "WAREHOUSE_MISMATCH",
      "Penalty warehouse must match the selected staff member's warehouse.",
      400
    );
  }

  const { staffWarehouseId } = await assertPenaltyAppliesToStaffType(
    parsed.staff_id,
    parsed.penalty_definition_id
  );

  const whId = staffWarehouseId ?? null;
  if (whId) {
    await assertWarehouseAccess(appUser.id, appUser.role, whId);
  }

  const computed = await computePenaltyPayload(adminClient, {
    staff_id: parsed.staff_id,
    penalty_definition_id: parsed.penalty_definition_id,
    incident_date: parsed.incident_date,
    computed_amount: parsed.computed_amount,
    manual_override: parsed.manual_override,
    amount_override: parsed.amount_override
  });

  const insertRow = {
    staff_id: parsed.staff_id,
    penalty_definition_id: parsed.penalty_definition_id,
    warehouse_id: whId,
    incident_date: parsed.incident_date,
    recorded_by_user_id: appUser.id,
    occurrence_index: computed.occurrence_index,
    computed_amount: computed.computed_amount,
    computed_points: computed.computed_points,
    structure_snapshot: computed.structure_snapshot,
    manual_override: computed.manual_override,
    notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
    proof_url: parsed.proof_url ?? null,
    status: "created" as const
  };

  if (insertRow.computed_amount == null && insertRow.computed_points == null) {
    throw new HttpError(
      "INVALID_AMOUNT",
      "Could not determine penalty amount; set an override amount or fix the definition.",
      400
    );
  }

  const { data, error } = await adminClient
    .from("penalty_records")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
