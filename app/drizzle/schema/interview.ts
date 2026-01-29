import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "../schemaHelper";
import { jobInfoTable } from "./jobInfo";
import { relations } from "drizzle-orm";

export const InterviewTable = pgTable("interviews", {
  id,
  jobInfoId: uuid()
    .notNull()
    .references(() => jobInfoTable.id, { onDelete: "cascade" }),
  duration: varchar().notNull(),
  humeChatId: varchar(),
  feedback: varchar(),
  createdAt,
  updatedAt,
});

export const InterviewRelations = relations(InterviewTable, ({ one }) => ({
  jobInfo: one(jobInfoTable, {
    fields: [InterviewTable.jobInfoId],
    references: [jobInfoTable.id],
    relationName: "jobInfo_interviews",
  }),
}));
