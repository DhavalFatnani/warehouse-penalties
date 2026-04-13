import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { AppRole, hasRequiredRole } from "@/lib/roles";

export type { AppRole } from "@/lib/roles";

export async function requireSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  return data.user;
}

export async function requireRole(roles: AppRole[]) {
  const user = await requireSession();
  const { data, error } = await adminClient
    .from("users")
    .select("id, role, email")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !data || !hasRequiredRole(data.role, roles)) {
    throw new Error("Forbidden");
  }

  return { authUser: user, appUser: data };
}

export async function getCurrentAppUser() {
  const user = await requireSession();
  const { data, error } = await adminClient
    .from("users")
    .select("id, role, email, full_name, is_active")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !data) {
    throw new Error("Forbidden");
  }

  return { authUser: user, appUser: data };
}
