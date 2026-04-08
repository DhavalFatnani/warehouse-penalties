import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { jsonOk, toErrorResponse } from "@/lib/http";

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    const includeInactive =
      new URL(req.url).searchParams.get("include_inactive") === "true";
    let query = adminClient
      .from("users")
      .select("id, auth_user_id, email, full_name, role, is_active, created_at")
      .order("created_at", { ascending: false });
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return jsonOk(data ?? []);
  } catch (e) {
    return toErrorResponse(e);
  }
}
