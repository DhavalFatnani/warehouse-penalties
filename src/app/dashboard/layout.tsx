import type { ReactNode } from "react";
import { Suspense } from "react";
import { getCurrentAppUser } from "@/lib/auth";
import { DashboardWithWarehouse } from "@/components/dashboard-with-warehouse";

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const { appUser } = await getCurrentAppUser();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">
          Loading dashboard…
        </div>
      }
    >
      <DashboardWithWarehouse role={appUser.role}>
        {children}
      </DashboardWithWarehouse>
    </Suspense>
  );
}
