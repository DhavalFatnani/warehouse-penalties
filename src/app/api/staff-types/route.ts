import { adminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { jsonOk, toErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireRole(["manager", "admin"]);
    const { data, error } = await adminClient
      .from("staff_types")
      .select("id, code, display_name, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return jsonOk(data ?? []);
  } catch (e) {
    return toErrorResponse(e);
  }
}
