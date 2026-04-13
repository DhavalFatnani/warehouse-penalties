import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import { isStoreManagerRole } from "@/lib/roles";
import { WarehousesAccessList } from "./warehouses-access-list";

export default async function WarehousesPage() {
  const { appUser } = await getCurrentAppUser();
  if (appUser.role === "admin") {
    redirect("/dashboard/admin/warehouses");
  }
  if (isStoreManagerRole(appUser.role)) {
    redirect("/dashboard");
  }
  return <WarehousesAccessList />;
}
