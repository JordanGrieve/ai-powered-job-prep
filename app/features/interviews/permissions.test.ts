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
import { canCreateInterview } from "./permissions";

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

  // Documents current behaviour rather than endorsing it. canCreateInterview
  // uses bare Promise.reject() as control flow with a blanket .catch(() =>
  // false), so a genuine fault (the count query throwing, auth() failing) is
  // indistinguishable from a legitimate denial - and silently blocks a paying
  // customer. If this test ever starts failing because the fault is being
  // surfaced instead of swallowed, that is an improvement: update it.
  it("swallows a failing count query and denies (known weakness)", async () => {
    grant({ "1_interview": true });
    mockInterviewCount(() => {
      throw new Error("connection terminated unexpectedly");
    });

    await expect(canCreateInterview()).resolves.toBe(false);
  });
});
