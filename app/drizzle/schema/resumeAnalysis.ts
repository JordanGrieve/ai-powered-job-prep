import { index, integer, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "../schemaHelper";
import { relations } from "drizzle-orm";
import { jobInfoTable } from "./jobInfo";

/**
 * A stored resume analysis RESULT. The uploaded file itself is deliberately
 * NOT persisted - it goes to Gemini as an inline file part and is discarded.
 *
 * That keeps the GDPR surface small (no CVs at rest, nothing to leak, nothing
 * to honour a deletion request over beyond this row) while still giving the
 * candidate a re-readable history and a rating they can watch improve across
 * successive drafts. fileName is kept only so the list is legible - "which
 * version was this?" - not to reconstruct anything.
 */
export const ResumeAnalysisTable = pgTable(
  "resume_analysis",
  {
    id,
    jobInfoId: uuid()
      .references(() => jobInfoTable.id, { onDelete: "cascade" })
      .notNull(),
    fileName: varchar({ length: 255 }).notNull(),
    // 1-10, same scale as questions and interviews so all three can share a
    // single progress trajectory.
    rating: integer().notNull(),
    feedback: varchar().notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("resume_analysis_job_info_id_idx").on(table.jobInfoId),
    // Progress query: analyses for a job info, newest first.
    index("resume_analysis_job_info_id_created_at_idx").on(
      table.jobInfoId,
      table.createdAt,
    ),
  ],
);

export const ResumeAnalysisRelations = relations(
  ResumeAnalysisTable,
  ({ one }) => ({
    jobInfo: one(jobInfoTable, {
      fields: [ResumeAnalysisTable.jobInfoId],
      references: [jobInfoTable.id],
      relationName: "jobInfo_resumeAnalyses",
    }),
  }),
);
