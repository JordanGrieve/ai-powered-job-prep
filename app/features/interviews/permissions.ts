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

async function getUserInterviewCount() {
  const { userId } = await getCurrentUser();
  if (userId == null) return 0;

  return getInterviewCount(userId);
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
