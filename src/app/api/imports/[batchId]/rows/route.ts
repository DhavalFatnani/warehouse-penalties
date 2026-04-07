import { adminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";

export async function GET(
  _req: Request,
  { params }: { params: { batchId: string } }
) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);

    const { data: batch, error: batchError } = await adminClient
      .from("staff_import_batches")
      .select("id, warehouse_id")
      .eq("id", params.batchId)
      .single();

    if (batchError || !batch) {
      throw new HttpError("NOT_FOUND", "Batch not found", 404);
    }

    if (batch.warehouse_id) {
      await assertWarehouseAccess(
        appUser.id,
        appUser.role,
        batch.warehouse_id
      );
    }

    const { data, error } = await adminClient
      .from("staff_import_rows")
      .select(
        "id, row_number, raw_payload, validation_status, validation_errors, created_at"
      )
      .eq("batch_id", params.batchId)
      .order("row_number", { ascending: true });

    if (error) throw new Error(error.message);
    return jsonOk(data ?? []);
  } catch (e) {
    return toErrorResponse(e);
  }
}
