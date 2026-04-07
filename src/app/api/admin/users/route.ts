import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { jsonOk, toErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireRole(["admin"]);
    const { data, error } = await adminClient
      .from("users")
      .select("id, auth_user_id, email, full_name, role, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return jsonOk(data ?? []);
  } catch (e) {
    return toErrorResponse(e);
  }
}
