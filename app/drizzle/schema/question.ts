import { index, pgTable, varchar, pgEnum, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "../schemaHelper";
import { relations } from "drizzle-orm";
import { jobInfoTable } from "./jobInfo";

export const questionDifficulties = ["junior", "mid-level", "senior"] as const;

export type QuestionDifficulty = (typeof questionDifficulties)[number];
export const questionDifficultyEnum = pgEnum(
  "question_difficulties",
  questionDifficulties,
);

export const QuestionTable = pgTable(
  "question",
  {
    id,
    jobId: uuid()
      .references(() => jobInfoTable.id, { onDelete: "cascade" })
      .notNull(),
    text: varchar().notNull(),
    difficulty: questionDifficultyEnum().notNull(),
    createdAt,
    updatedAt,
  },
  // No reader yet - this indexes the cascade-delete path off job_info.
  (table) => [index("question_job_id_idx").on(table.jobId)],
);

export const questionRelations = relations(QuestionTable, ({ one }) => ({
  jobInfo: one(jobInfoTable, {
    fields: [QuestionTable.jobId],
    references: [jobInfoTable.id],
    relationName: "jobInfo_questions",
  }),
}));
