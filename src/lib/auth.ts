import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export type AppRole = "manager" | "admin";

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

  if (error || !data || !roles.includes(data.role)) {
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
