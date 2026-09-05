import { db } from "@/app/drizzle/db";
import { InterviewTable, jobInfoTable } from "@/app/drizzle/schema";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { hasPermission } from "@/app/services/clerk/lib/hasPermission";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("permissions");

/**
 * Whether the caller may start another interview.
 *
 * Rewritten from a `Promise.any` over branches that used bare
 * `Promise.reject()` as control flow, wrapped in `.catch(() => false)`. That
 * shape could not tell a legitimate denial from a fault: a dropped database
 * connection or a failing auth() call produced exactly the same `false` as
 * "you are out of quota". The user-visible consequence was the worst kind -
 * a PAYING customer told they had hit their plan limit because Postgres
 * blipped, with nothing in the logs to contradict it.
 *
 * Now the two are distinguishable. A fault is logged as an error and
 * rethrown; callers surface it as a generic failure rather than a paywall.
 * Denial stays a plain `false`.
 */
export async function canCreateInterview(): Promise<boolean> {
  try {
    // Unlimited short-circuits: no reason to count rows we will ignore.
    if (await hasPermission("unlimited_interviews")) return true;
    if (!(await hasPermission("1_interview"))) return false;

    return (await getUserInterviewCount()) < 1;
  } catch (error) {
    log.error("interview permission check failed", error);
    // Deliberately NOT `return false`. Swallowing this is what made a database
    // fault look like a plan limit.
    throw new PermissionCheckError(
      "Could not check your plan. Please try again.",
      { cause: error },
    );
  }
}

/** Distinguishes "the check itself broke" from "you are not allowed". */
export class PermissionCheckError extends Error {
  readonly name = "PermissionCheckError";
}

export async function getUserInterviewCount() {
  const { userId } = await getCurrentUser();
  if (userId == null) return 0;

  return getInterviewCount(userId);
}

/**
 * Plan + usage for display. The app previously never told a user which plan
 * they were on or how much quota was left, so the first signal a free user got
 * was a silent redirect to /app/upgrade after they had already committed to
 * starting an interview.
 *
 * Only interview usage is meaningful today - the questions and resume
 * entitlements are declared but enforced nowhere.
 */
export async function getInterviewUsage(): Promise<{
  used: number;
  limit: number | null;
  isUnlimited: boolean;
}> {
  const [unlimited, single] = await Promise.all([
    hasPermission("unlimited_interviews"),
    hasPermission("1_interview"),
  ]);

  if (unlimited) {
    return { used: await getUserInterviewCount(), limit: null, isUnlimited: true };
  }

  return {
    used: await getUserInterviewCount(),
    limit: single ? 1 : 0,
    isUnlimited: false,
  };
}

async function getInterviewCount(userId: string) {
  const [{ count: c }] = await db
    .select({ count: count() })
    .from(InterviewTable)
    .innerJoin(jobInfoTable, eq(InterviewTable.jobInfoId, jobInfoTable.id))
    .where(
      and(
        eq(jobInfoTable.userId, userId),
        isNotNull(InterviewTable.humeChatId),
      ),
    );

  return c;
}
