import { index, integer, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "../schemaHelper";
import { jobInfoTable } from "./jobInfo";
import { relations } from "drizzle-orm";

export const InterviewTable = pgTable("interviews", {
  id,
  jobInfoId: uuid()
    .notNull()
    .references(() => jobInfoTable.id, { onDelete: "cascade" }),
  // HH:MM:SS - matches the format validated in the update action.
  duration: varchar({ length: 8 }).notNull(),
  humeChatId: varchar({ length: 36 }),
  feedback: varchar(),
  // 1-10, extracted alongside the markdown feedback so interviews can appear
  // on the same progress trajectory as practice questions.
  rating: integer(),
  createdAt,
  updatedAt,
}, (table) => [index("interviews_job_info_id_idx").on(table.jobInfoId)]);

export const InterviewRelations = relations(InterviewTable, ({ one }) => ({
  jobInfo: one(jobInfoTable, {
    fields: [InterviewTable.jobInfoId],
    references: [jobInfoTable.id],
    relationName: "jobInfo_interviews",
  }),
}));
