import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { jsonOk, toErrorResponse } from "@/lib/http";

/**
 * Admin-only: permanently removes bundled demo staff (EMP-PP/IE/ASM/RDR/RIDER-*)
 * and any staff whose name contains "removed sample", plus their penalty records.
 */
export async function POST() {
  try {
    await requireRole(["admin"]);
    const { data, error } = await adminClient.rpc("purge_sample_staff");
    if (error) throw new Error(error.message);
    return jsonOk(
      (data ?? {
        penalty_records_deleted: 0,
        staff_deleted: 0
      }) as Record<string, unknown>
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
