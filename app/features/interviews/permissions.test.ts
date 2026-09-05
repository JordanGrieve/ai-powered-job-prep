import { beforeEach, describe, expect, it, vi } from "vitest";

// These have to be mocked before the module under test is imported, because
// permissions.ts pulls in the Drizzle client and Clerk's auth() at module scope.
vi.mock("@/app/services/clerk/lib/hasPermission", () => ({
  hasPermission: vi.fn(),
}));
vi.mock("@/app/services/clerk/lib/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/app/drizzle/db", () => ({
  db: { select: vi.fn() },
}));

import { db } from "@/app/drizzle/db";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { hasPermission } from "@/app/services/clerk/lib/hasPermission";
import { canCreateInterview, PermissionCheckError } from "./permissions";

const mockedHasPermission = vi.mocked(hasPermission);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);

/** Stubs the fluent select().from().innerJoin().where() count query. */
function mockInterviewCount(count: number | (() => never)) {
  const where = vi.fn(() =>
    typeof count === "function"
      ? Promise.reject(count())
      : Promise.resolve([{ count }]),
  );
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ innerJoin: () => ({ where }) }),
  } as never);
}

function grant(permissions: Record<string, boolean>) {
  mockedHasPermission.mockImplementation(async (permission) =>
    Boolean(permissions[permission]),
  );
}

describe("canCreateInterview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentUser.mockResolvedValue({
      userId: "user_123",
      redirectToSignIn: vi.fn(),
      user: null,
    } as never);
  });

  it("allows an unlimited plan regardless of existing interview count", async () => {
    grant({ unlimited_interviews: true });
    mockInterviewCount(99);

    await expect(canCreateInterview()).resolves.toBe(true);
  });

  it("allows a 1_interview plan when the user has used none", async () => {
    grant({ "1_interview": true });
    mockInterviewCount(0);

    await expect(canCreateInterview()).resolves.toBe(true);
  });

  it("denies a 1_interview plan once one interview has been started", async () => {
    grant({ "1_interview": true });
    mockInterviewCount(1);

    await expect(canCreateInterview()).resolves.toBe(false);
  });

  it("denies when the user holds no interview entitlement at all", async () => {
    grant({});
    mockInterviewCount(0);

    await expect(canCreateInterview()).resolves.toBe(false);
  });

  // This previously asserted the opposite - that a fault was swallowed into a
  // silent `false`. That behaviour told PAYING customers they had hit their
  // plan limit whenever Postgres blipped, and was indistinguishable in the
  // logs from a real denial. A fault must now be distinguishable from a
  // denial.
  it("throws rather than denying when the count query fails", async () => {
    grant({ "1_interview": true });
    mockInterviewCount(() => {
      throw new Error("connection terminated unexpectedly");
    });

    await expect(canCreateInterview()).rejects.toThrow(PermissionCheckError);
  });

  it("throws rather than denying when the entitlement lookup fails", async () => {
    mockedHasPermission.mockRejectedValue(new Error("clerk unreachable"));
    mockInterviewCount(0);

    await expect(canCreateInterview()).rejects.toThrow(PermissionCheckError);
  });

  it("does not count rows when the plan is unlimited", async () => {
    grant({ unlimited_interviews: true });
    mockInterviewCount(0);

    await expect(canCreateInterview()).resolves.toBe(true);
    // Short-circuit: counting rows we are about to ignore is wasted work on
    // an uncached query that runs on every interview-creation attempt.
    expect(db.select).not.toHaveBeenCalled();
  });
});
