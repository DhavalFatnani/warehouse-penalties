import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import {
  fetchPenaltyViewForManager,
  getStaffIdsInAccessibleWarehouses
} from "@/lib/query-scope";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { settlementPreviewQuerySchema } from "@/lib/validators";

type Row = Record<string, unknown>;
type GroupBy = "staff" | "staff_type" | "warehouse";

export async function GET(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const sp = req.nextUrl.searchParams;
    const parsed = settlementPreviewQuerySchema.safeParse({
      incident_date_from: sp.get("incident_date_from") ?? undefined,
      incident_date_to: sp.get("incident_date_to") ?? undefined,
      warehouse_id: sp.get("warehouse_id") || undefined,
      staff_id: sp.get("staff_id") || undefined,
      staff_type_id: sp.get("staff_type_id") || undefined,
      group_by: sp.get("group_by") || undefined
    });
    if (!parsed.success) return toErrorResponse(parsed.error);

    const {
      incident_date_from: from,
      incident_date_to: to,
      warehouse_id: warehouseId,
      staff_id: staffIdFilter,
      staff_type_id: staffTypeIdFilter,
      group_by: groupByParam
    } = parsed.data;
    const groupBy: GroupBy = groupByParam ?? "staff";

    if (warehouseId && appUser.role !== "admin") {
      await assertWarehouseAccess(appUser.id, appUser.role, warehouseId);
    }

    let list: Row[] = [];

    if (appUser.role === "admin") {
      let q = adminClient
        .from("v_penalty_records_with_staff")
        .select("*")
        .eq("status", "created")
        .order("incident_date", { ascending: true });

      if (from) q = q.gte("incident_date", from);
      if (to) q = q.lte("incident_date", to);
      if (warehouseId) q = q.eq("warehouse_id", warehouseId);
      if (staffIdFilter) q = q.eq("staff_id", staffIdFilter);
      if (staffTypeIdFilter) q = q.eq("staff_type_id", staffTypeIdFilter);

      const res = await q.limit(5000);
      if (res.error) throw new Error(res.error.message);
      list = (res.data ?? []) as Row[];
    } else {
      const { warehouseIds, staffIds } =
        await getStaffIdsInAccessibleWarehouses(appUser.id, appUser.role);

      if (!warehouseIds.length || !staffIds?.length) {
        return jsonOk({
          groups: [],
          record_ids: [],
          group_by: groupBy
        });
      }

      if (staffIdFilter && !staffIds.includes(staffIdFilter)) {
        throw new HttpError(
          "FORBIDDEN_STAFF",
          "No access to this staff member",
          403
        );
      }

      list = await fetchPenaltyViewForManager(
        warehouseIds,
        staffIds,
        warehouseId,
        (q) => {
          let x = q.eq("status", "created");
          if (from) x = x.gte("incident_date", from);
          if (to) x = x.lte("incident_date", to);
          if (staffIdFilter) x = x.eq("staff_id", staffIdFilter);
          if (staffTypeIdFilter) x = x.eq("staff_type_id", staffTypeIdFilter);
          return x.order("incident_date", { ascending: true }).limit(5000);
        }
      );
    }

    list.sort((a, b) =>
      String(a.incident_date ?? "").localeCompare(
        String(b.incident_date ?? "")
      )
    );

    const groups = buildSettlementGroups(list, groupBy);

    return jsonOk({
      groups,
      record_ids: list.map((r) => String(r.id)),
      group_by: groupBy
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

function buildSettlementGroups(list: Row[], groupBy: GroupBy) {
  type G = {
    group_key: string;
    group_by: GroupBy;
    title: string;
    subtitle: string | null;
    staff_id: string | null;
    employee_code: string | null;
    warehouse_id: string | null;
    warehouse_name: string | null;
    staff_type_id: string | null;
    staff_type_name: string | null;
    total: number;
    count: number;
    distinct_staff_count: number;
    records: Row[];
  };

  const groupsMap = new Map<string, G>();

  for (const r of list) {
    let key: string;
    switch (groupBy) {
      case "staff":
        key = String(r.staff_id ?? "");
        break;
      case "staff_type":
        key = String(r.staff_type_id ?? "");
        break;
      case "warehouse":
        key =
          r.warehouse_id == null || r.warehouse_id === ""
            ? "__none__"
            : String(r.warehouse_id);
        break;
    }

    const g =
      groupsMap.get(key) ??
      ({
        group_key: key,
        group_by: groupBy,
        title: "",
        subtitle: null,
        staff_id: null,
        employee_code: null,
        warehouse_id: null,
        warehouse_name: null,
        staff_type_id: null,
        staff_type_name: null,
        total: 0,
        count: 0,
        distinct_staff_count: 0,
        records: [] as Row[]
      } satisfies G);

    if (g.records.length === 0) {
      g.title = groupTitle(r, groupBy, key);
      g.staff_id = groupBy === "staff" ? String(r.staff_id ?? "") : null;
      g.employee_code = groupBy === "staff" ? (r.employee_code as string | null) ?? null : null;
      g.warehouse_id =
        groupBy === "warehouse"
          ? r.warehouse_id == null || r.warehouse_id === ""
            ? null
            : String(r.warehouse_id)
          : (r.warehouse_id as string | null) ?? null;
      g.warehouse_name = (r.warehouse_name as string | null) ?? null;
      g.staff_type_id =
        groupBy === "staff_type"
          ? String(r.staff_type_id ?? "")
          : (r.staff_type_id as string | null) ?? null;
      g.staff_type_name = (r.staff_type_name as string | null) ?? null;
    }

    g.total += Number(r.computed_amount ?? 0);
    g.count += 1;
    g.records.push(r);
    groupsMap.set(key, g);
  }

  const groups = [...groupsMap.values()].map((g) => {
    const distinct = new Set(
      g.records.map((x) => String(x.staff_id ?? ""))
    ).size;
    g.distinct_staff_count = distinct;
    g.subtitle = groupSubtitle(g, groupBy);
    return g;
  });

  groups.sort((a, b) => b.total - a.total);
  return groups;
}

function groupTitle(r: Row, groupBy: GroupBy, key: string) {
  switch (groupBy) {
    case "staff":
      return String(r.staff_full_name ?? key);
    case "staff_type":
      return String(
        r.staff_type_name ?? r.staff_type_code ?? "Unknown type"
      );
    case "warehouse":
      return key === "__none__"
        ? "No warehouse"
        : String(r.warehouse_name ?? r.warehouse_code ?? key);
    default: {
      const _e: never = groupBy;
      return _e;
    }
  }
}

function groupSubtitle(
  g: {
    records: Row[];
    count: number;
    distinct_staff_count: number;
  },
  groupBy: GroupBy
) {
  const nPen = g.count;
  const nStaff = g.distinct_staff_count;
  switch (groupBy) {
    case "staff": {
      const r0 = g.records[0];
      const wh = (r0?.warehouse_name as string | null) ?? null;
      const st = (r0?.staff_type_name as string | null) ?? null;
      const bits = [wh, st, `${nPen} penalties`].filter(Boolean);
      return bits.join(" · ") || null;
    }
    case "staff_type":
      return `${nStaff} staff · ${nPen} penalties`;
    case "warehouse":
      return `${nStaff} staff · ${nPen} penalties`;
    default: {
      const _e: never = groupBy;
      return _e;
    }
  }
}
