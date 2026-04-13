import { HttpError } from "@/lib/http";

export function assertRoleChangeAllowed(params: {
  actorRole: string;
  targetRole: string;
  nextRole: string;
  activeAdminCount: number;
  targetIsActive: boolean;
}) {
  const { actorRole, targetRole, nextRole, activeAdminCount, targetIsActive } = params;

  if (actorRole !== "admin") {
    throw new HttpError("FORBIDDEN", "Only admins can change roles", 403);
  }

  if (
    targetRole === "admin" &&
    nextRole !== "admin" &&
    targetIsActive &&
    activeAdminCount <= 1
  ) {
    throw new HttpError(
      "LAST_ADMIN_GUARD",
      "Cannot demote the last active admin",
      400
    );
  }
}

export function assertDeactivateAllowed(params: {
  actorRole: string;
  targetRole: string;
  targetIsActive: boolean;
  nextIsActive: boolean;
  activeAdminCount: number;
}) {
  const { actorRole, targetRole, targetIsActive, nextIsActive, activeAdminCount } = params;

  if (actorRole !== "admin") {
    throw new HttpError("FORBIDDEN", "Only admins can update user status", 403);
  }

  if (
    targetRole === "admin" &&
    targetIsActive &&
    !nextIsActive &&
    activeAdminCount <= 1
  ) {
    throw new HttpError(
      "LAST_ADMIN_GUARD",
      "Cannot deactivate the last active admin",
      400
    );
  }
}

export function assertDeleteUserAllowed(params: {
  actorRole: string;
  actorUserId: string;
  targetUserId: string;
  targetRole: string;
  targetIsActive: boolean;
  activeAdminCount: number;
}) {
  const {
    actorRole,
    actorUserId,
    targetUserId,
    targetRole,
    targetIsActive,
    activeAdminCount
  } = params;

  if (actorRole !== "admin") {
    throw new HttpError("FORBIDDEN", "Only admins can remove users", 403);
  }

  if (actorUserId === targetUserId) {
    throw new HttpError(
      "FORBIDDEN",
      "You cannot remove your own account while signed in",
      403
    );
  }

  if (
    targetRole === "admin" &&
    targetIsActive &&
    activeAdminCount <= 1
  ) {
    throw new HttpError(
      "LAST_ADMIN_GUARD",
      "Cannot remove the last active admin",
      400
    );
  }
}
