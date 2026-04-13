import { HttpError } from "@/lib/http";

export type AppRole =
  | "store_manager"
  | "central_team_member"
  | "manager"
  | "admin";

export function isAdminRole(role: string): role is "admin" {
  return role === "admin";
}

export function isStoreManagerRole(role: string): role is "store_manager" {
  return role === "store_manager";
}

export function isCentralTeamRole(role: string): role is "central_team_member" {
  return role === "central_team_member";
}

export function isManagerLikeRole(role: string): role is AppRole {
  return (
    role === "manager" ||
    role === "store_manager" ||
    role === "central_team_member" ||
    role === "admin"
  );
}

export function hasRequiredRole(userRole: string, requiredRoles: AppRole[]): boolean {
  if (!isManagerLikeRole(userRole)) return false;
  if (requiredRoles.includes(userRole)) return true;
  if (
    requiredRoles.includes("manager") &&
    (userRole === "store_manager" || userRole === "central_team_member")
  ) {
    return true;
  }
  return false;
}

/** Store managers cannot access catalog configuration APIs/pages. */
export function assertCatalogAccessAllowed(role: string) {
  if (!isStoreManagerRole(role)) return;
  throw new HttpError(
    "FORBIDDEN",
    "Store managers do not have access to the catalog section.",
    403
  );
}

export function assertStoreManagerWarehouseLimit(
  role: string,
  warehouseIds: string[]
) {
  if (!isStoreManagerRole(role)) return;
  if (warehouseIds.length <= 1) return;
  throw new HttpError(
    "STORE_MANAGER_SINGLE_WAREHOUSE",
    "Store managers can only be assigned to one warehouse.",
    400
  );
}
