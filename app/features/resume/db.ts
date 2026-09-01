import { db } from "@/app/drizzle/db";
import { ResumeAnalysisTable } from "@/app/drizzle/schema";
import { revalidateResumeAnalysisCache } from "./dbCache";

export async function insertResumeAnalysis(
  analysis: typeof ResumeAnalysisTable.$inferInsert,
) {
  const [created] = await db
    .insert(ResumeAnalysisTable)
    .values(analysis)
    .returning({
      id: ResumeAnalysisTable.id,
      jobInfoId: ResumeAnalysisTable.jobInfoId,
    });

  revalidateResumeAnalysisCache(created);

  return created;
}
