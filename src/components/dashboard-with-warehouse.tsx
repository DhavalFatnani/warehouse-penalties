"use client";

import type { ReactNode } from "react";
import type { AppRole } from "@/lib/auth";
import { DashboardWarehouseProvider } from "@/components/dashboard-warehouse-context";
import { DashboardShell } from "@/components/dashboard-shell";

export function DashboardWithWarehouse({
  role,
  children
}: {
  role: AppRole;
  children: ReactNode;
}) {
  return (
    <DashboardWarehouseProvider userRole={role}>
      <DashboardShell role={role}>{children}</DashboardShell>
    </DashboardWarehouseProvider>
  );
}
