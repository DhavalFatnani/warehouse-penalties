import type { ReactNode } from "react";
import { getCurrentAppUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const { appUser } = await getCurrentAppUser();

  return <DashboardShell role={appUser.role}>{children}</DashboardShell>;
}
