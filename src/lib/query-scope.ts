import { adminClient } from "@/lib/supabase/admin";
import { getAccessibleWarehouseIds } from "@/lib/warehouse-access";

/**
 * Staff IDs whose home warehouse is in the accessible set (for penalty record visibility).
 */
export async function getStaffIdsInAccessibleWarehouses(
  appUserId: string,
  role: string
) {
  const warehouseIds = await getAccessibleWarehouseIds(appUserId, role);
  if (role === "admin" || warehouseIds.length === 0) {
    return { warehouseIds, staffIds: null as string[] | null };
  }

  const { data, error } = await adminClient
    .from("staff")
    .select("id")
    .in("warehouse_id", warehouseIds);

  if (error) throw new Error(error.message);
  return {
    warehouseIds,
    staffIds: (data ?? []).map((r) => r.id)
  };
}

/**
 * @deprecated Do not pass to `.or()`. PostgREST treats commas as OR-separators, so
 * `warehouse_id.in.(a,b)` inside an `.or()` filter string breaks with multiple UUIDs.
 * Use two queries: `.in('warehouse_id', ids)` and `.is('warehouse_id', null).in('staff_id', ids)` then merge.
 */
export function buildRecordVisibilityOrFilter(
  warehouseIds: string[],
  staffIds: string[]
) {
  if (!warehouseIds.length || !staffIds.length) return null;
  return `warehouse_id.in.(${warehouseIds.join(",")}),and(warehouse_id.is.null,staff_id.in.(${staffIds.join(",")}))`;
}

/**
 * Manager visibility without broken `.or()` filters (see buildRecordVisibilityOrFilter).
 * Merges two disjoint queries by id.
 *
 * When `narrowWarehouseId` is set, only rows for that warehouse are included (second branch skipped).
 */
export async function fetchPenaltyViewForManager(
  warehouseIds: string[],
  staffIds: string[],
  narrowWarehouseId: string | null | undefined,
  configure: (q: AnyPenaltyViewQuery) => AnyPenaltyViewQuery,
  selectList = "*"
): Promise<Record<string, unknown>[]> {
  if (!warehouseIds.length || !staffIds.length) return [];

  const narrow =
    narrowWarehouseId != null && narrowWarehouseId !== ""
      ? narrowWarehouseId
      : null;

  const base1 =
    narrow != null
      ? adminClient
          .from("v_penalty_records_with_staff")
          .select(selectList)
          .eq("warehouse_id", narrow)
      : adminClient
          .from("v_penalty_records_with_staff")
          .select(selectList)
          .in("warehouse_id", warehouseIds);

  const q1 = configure(base1);

  if (narrow != null) {
    const res = await q1;
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []) as Record<string, unknown>[];
  }

  const q2 = configure(
    adminClient
      .from("v_penalty_records_with_staff")
      .select(selectList)
      .is("warehouse_id", null)
      .in("staff_id", staffIds)
  );

  const [a, b] = await Promise.all([q1, q2]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of a.data ?? []) {
    if (row && typeof row === "object" && "id" in row && row.id) {
      byId.set(String(row.id), row as Record<string, unknown>);
    }
  }
  for (const row of b.data ?? []) {
    if (row && typeof row === "object" && "id" in row && row.id) {
      byId.set(String(row.id), row as Record<string, unknown>);
    }
  }
  return [...byId.values()];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPenaltyViewQuery = any;
