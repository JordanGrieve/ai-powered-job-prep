import { db } from "@/app/drizzle/db";
import { QuestionTable } from "@/app/drizzle/schema";
import { revalidateQuestionCache } from "./dbCache";
import { eq } from "drizzle-orm";

export async function insertQuestion(
  question: typeof QuestionTable.$inferInsert,
) {
  const [newQuestion] = await db
    .insert(QuestionTable)
    .values(question)
    .returning({ id: QuestionTable.id, jobInfoId: QuestionTable.jobId });

  revalidateQuestionCache(newQuestion);

  return newQuestion;
}

export async function updateQuestion(
  id: string,
  question: Partial<typeof QuestionTable.$inferInsert>,
) {
  const [updated] = await db
    .update(QuestionTable)
    .set(question)
    .where(eq(QuestionTable.id, id))
    .returning({ id: QuestionTable.id, jobInfoId: QuestionTable.jobId });

  // A zero-row UPDATE returns [], and revalidateQuestionCache destructures.
  if (updated == null) return null;

  revalidateQuestionCache(updated);

  return updated;
}
