import { adminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/http";

export async function getAccessibleWarehouseIds(appUserId: string, role: string) {
  if (role === "admin") {
    const { data, error } = await adminClient.from("warehouses").select("id");
    if (error) throw new Error(error.message);
    return (data ?? []).map((w) => w.id);
  }

  const { data, error } = await adminClient
    .from("user_warehouse_access")
    .select("warehouse_id")
    .eq("user_id", appUserId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.warehouse_id);
}

export async function assertWarehouseAccess(
  appUserId: string,
  role: string,
  warehouseId: string
) {
  if (role === "admin") return;

  const { data, error } = await adminClient
    .from("user_warehouse_access")
    .select("warehouse_id")
    .eq("user_id", appUserId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new HttpError(
      "FORBIDDEN_WAREHOUSE",
      "No access to this warehouse",
      403
    );
  }
}
