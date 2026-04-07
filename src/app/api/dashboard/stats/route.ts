import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { fetchDashboardStats } from "@/lib/dashboard-stats";
import { jsonOk, toErrorResponse } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const warehouseFilter = req.nextUrl.searchParams.get("warehouse_id");
    const stats = await fetchDashboardStats(appUser, warehouseFilter);
    return jsonOk(stats);
  } catch (e) {
    return toErrorResponse(e);
  }
}
