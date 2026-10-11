import { db } from "@/app/drizzle/db";
import { InterviewTable } from "@/app/drizzle/schema";
import { revalidateInterviewCache } from "./dbCache";
import { and, eq, isNull } from "drizzle-orm";

export async function insertInterview(
  interview: typeof InterviewTable.$inferInsert,
) {
  const [newInterview] = await db
    .insert(InterviewTable)
    .values(interview)
    .returning({ id: InterviewTable.id, jobInfoId: InterviewTable.jobInfoId });

  revalidateInterviewCache(newInterview);

  return newInterview;
}

/**
 * Deletes an interview row only while it is still unconnected.
 *
 * The `humeChatId IS NULL` predicate is part of the statement rather than a
 * check before it, so a chat id landing between the two cannot be raced into
 * deleting a real interview. A connected interview is a paid call with a
 * transcript behind it and must never be removed by this path.
 */
export async function deleteUnconnectedInterview(id: string) {
  const [deleted] = await db
    .delete(InterviewTable)
    .where(and(eq(InterviewTable.id, id), isNull(InterviewTable.humeChatId)))
    .returning({ id: InterviewTable.id, jobInfoId: InterviewTable.jobInfoId });

  if (deleted == null) return null;

  revalidateInterviewCache(deleted);

  return deleted;
}

export async function updateInterview(
  id: string,
  interview: Partial<typeof InterviewTable.$inferInsert>,
) {
  const [newInterview] = await db
    .update(InterviewTable)
    .set(interview)
    .where(eq(InterviewTable.id, id))
    .returning({ id: InterviewTable.id, jobInfoId: InterviewTable.jobInfoId });

  if (newInterview == null) return null;

  revalidateInterviewCache(newInterview);

  return newInterview;
}
