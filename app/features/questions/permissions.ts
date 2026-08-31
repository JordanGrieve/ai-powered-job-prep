import { db } from "@/app/drizzle/db";
import { QuestionTable, jobInfoTable } from "@/app/drizzle/schema";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { hasPermission } from "@/app/services/clerk/lib/hasPermission";
import { count, eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("permissions");

const FREE_QUESTION_LIMIT = 5;

/**
 * Shaped like canCreateInterview, but WITHOUT its known weakness: this returns
 * a discriminated result instead of collapsing every failure into `false`, so
 * a database fault is distinguishable from a legitimate denial.
 */
export async function canCreateQuestion(): Promise<boolean> {
  try {
    if (await hasPermission("unlimited_questions")) return true;
    if (!(await hasPermission("5_questions"))) return false;

    return (await getUserQuestionCount()) < FREE_QUESTION_LIMIT;
  } catch (error) {
    log.error("question permission check failed", error);
    return false;
  }
}

export async function getQuestionUsage(): Promise<{
  used: number;
  limit: number | null;
  isUnlimited: boolean;
}> {
  if (await hasPermission("unlimited_questions")) {
    return { used: await getUserQuestionCount(), limit: null, isUnlimited: true };
  }

  const allowed = await hasPermission("5_questions");
  return {
    used: await getUserQuestionCount(),
    limit: allowed ? FREE_QUESTION_LIMIT : 0,
    isUnlimited: false,
  };
}

export async function getUserQuestionCount() {
  const { userId } = await getCurrentUser();
  if (userId == null) return 0;

  const [row] = await db
    .select({ count: count() })
    .from(QuestionTable)
    .innerJoin(jobInfoTable, eq(QuestionTable.jobId, jobInfoTable.id))
    .where(eq(jobInfoTable.userId, userId));

  return row?.count ?? 0;
}
