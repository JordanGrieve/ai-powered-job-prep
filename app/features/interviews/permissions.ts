import { db } from "@/app/drizzle/db";
import { InterviewTable, jobInfoTable } from "@/app/drizzle/schema";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { hasPermission } from "@/app/services/clerk/lib/hasPermission";
import { and, count, eq, isNotNull } from "drizzle-orm";

export async function canCreateInterview() {
  return await Promise.any([
    hasPermission("unlimited_interviews").then(
      (bool) => bool || Promise.reject(),
    ),
    Promise.all([hasPermission("1_interview"), getUserInterviewCount()]).then(
      ([bool, count]) => {
        if (bool && count < 1) return true;
        return Promise.reject();
      },
    ),
  ]).catch(() => false);
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
