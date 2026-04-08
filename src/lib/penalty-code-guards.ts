import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http";

export type PenaltyCodeGuardRow = {
  warehouse_id: string | null;
  is_active: boolean;
};

export async function fetchPenaltyCodeWarehouse(
  client: SupabaseClient,
  penaltyCodeId: string
): Promise<PenaltyCodeGuardRow> {
  const { data, error } = await client
    .from("penalty_codes")
    .select("warehouse_id, is_active")
    .eq("id", penaltyCodeId)
    .single();
  if (error || !data) {
    throw new HttpError("NOT_FOUND", "Penalty code not found", 404);
  }
  return {
    warehouse_id: (data.warehouse_id as string | null) ?? null,
    is_active: Boolean(data.is_active)
  };
}

/** Use when attaching a code to a new or updated definition (must be active). */
export function assertPenaltyCodeActiveForUse(row: PenaltyCodeGuardRow) {
  if (!row.is_active) {
    throw new HttpError(
      "PENALTY_CODE_INACTIVE",
      "This penalty code was removed and cannot be used for new or updated definitions.",
      400
    );
  }
}

/**
 * Global definition (warehouse null) may only use global codes.
 * Warehouse-scoped definition may use global codes or codes for that warehouse.
 */
export function assertPenaltyCodeMatchesDefinitionWarehouse(
  codeWarehouseId: string | null,
  definitionWarehouseId: string | null
) {
  if (definitionWarehouseId == null) {
    if (codeWarehouseId != null) {
      throw new HttpError(
        "BAD_REQUEST",
        "Global definitions must use a global penalty code (no warehouse on the code)",
        400
      );
    }
    return;
  }
  if (codeWarehouseId == null) return;
  if (codeWarehouseId !== definitionWarehouseId) {
    throw new HttpError(
      "BAD_REQUEST",
      "Penalty code is registered for a different warehouse",
      400
    );
  }
}
