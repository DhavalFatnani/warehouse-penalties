import { describe, expect, it } from "vitest";
import {
  assertDeactivateAllowed,
  assertDeleteUserAllowed,
  assertRoleChangeAllowed
} from "@/lib/admin-guards";

describe("admin role/status guards", () => {
  it("blocks demoting last active admin", () => {
    expect(() =>
      assertRoleChangeAllowed({
        actorRole: "admin",
        targetRole: "admin",
        nextRole: "central_team_member",
        activeAdminCount: 1,
        targetIsActive: true
      })
    ).toThrow("Cannot demote the last active admin");
  });

  it("allows demotion when another active admin exists", () => {
    expect(() =>
      assertRoleChangeAllowed({
        actorRole: "admin",
        targetRole: "admin",
        nextRole: "store_manager",
        activeAdminCount: 2,
        targetIsActive: true
      })
    ).not.toThrow();
  });

  it("blocks deactivating last active admin", () => {
    expect(() =>
      assertDeactivateAllowed({
        actorRole: "admin",
        targetRole: "admin",
        targetIsActive: true,
        nextIsActive: false,
        activeAdminCount: 1
      })
    ).toThrow("Cannot deactivate the last active admin");
  });

  it("blocks self-deletion", () => {
    expect(() =>
      assertDeleteUserAllowed({
        actorRole: "admin",
        actorUserId: "same-id",
        targetUserId: "same-id",
        targetRole: "manager",
        targetIsActive: true,
        activeAdminCount: 2
      })
    ).toThrow("You cannot remove your own account");
  });

  it("blocks deleting last active admin", () => {
    expect(() =>
      assertDeleteUserAllowed({
        actorRole: "admin",
        actorUserId: "actor",
        targetUserId: "target",
        targetRole: "admin",
        targetIsActive: true,
        activeAdminCount: 1
      })
    ).toThrow("Cannot remove the last active admin");
  });
});
