import { adminClient } from "@/lib/supabase/admin";
import {
  fetchPenaltyViewForManager,
  getStaffIdsInAccessibleWarehouses
} from "@/lib/query-scope";

type AppUser = {
  id: string;
  role: string;
};

const STATS_SELECT =
  "id, status, computed_amount, staff_id, staff_full_name, incident_date, penalty_title, warehouse_id, warehouse_name, recorded_at";

export async function fetchDashboardStats(
  appUser: AppUser,
  warehouseFilter: string | null
) {
  let list: Record<string, unknown>[] = [];

  if (appUser.role === "admin") {
    let base = adminClient
      .from("v_penalty_records_with_staff")
      .select(STATS_SELECT)
      .order("recorded_at", { ascending: false });

    if (warehouseFilter) {
      base = base.eq("warehouse_id", warehouseFilter);
    }

    const { data: rows, error } = await base.limit(2000);
    if (error) throw new Error(error.message);
    list = (rows ?? []) as Record<string, unknown>[];
  } else {
    const { warehouseIds, staffIds } =
      await getStaffIdsInAccessibleWarehouses(appUser.id, appUser.role);

    if (!warehouseIds.length || !staffIds?.length) {
      return {
        pending_total_amount: 0,
        pending_count: 0,
        settled_count_cycle: 0,
        top_staff: [] as {
          staff_id: string;
          name: string;
          total: number;
          count: number;
        }[],
        recent: [] as Record<string, unknown>[]
      };
    }

    const merged = await fetchPenaltyViewForManager(
      warehouseIds,
      staffIds,
      warehouseFilter,
      (q) => q.order("recorded_at", { ascending: false }).limit(2000),
      STATS_SELECT
    );
    merged.sort((a, b) =>
      String(b.recorded_at ?? "").localeCompare(String(a.recorded_at ?? ""))
    );
    list = merged;
  }

  const created = list.filter((r) => r.status === "created");
  const settled = list.filter((r) => r.status === "settled");

  const pendingTotal = created.reduce(
    (s, r) => s + Number(r.computed_amount ?? 0),
    0
  );

  const byStaff = new Map<
    string,
    { staff_id: string; name: string; total: number; count: number }
  >();
  for (const r of created) {
    const id = r.staff_id;
    const cur = byStaff.get(String(id)) ?? {
      staff_id: String(id),
      name: String(r.staff_full_name ?? id),
      total: 0,
      count: 0
    };
    cur.total += Number(r.computed_amount ?? 0);
    cur.count += 1;
    byStaff.set(String(id), cur);
  }

  const top_staff = [...byStaff.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    pending_total_amount: pendingTotal,
    pending_count: created.length,
    settled_count_cycle: settled.length,
    top_staff,
    recent: list.slice(0, 12)
  };
}
