import { pgTable, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "../schemaHelper";
import { relations } from "drizzle-orm";
import { UserTable } from "./user";
import { QuestionTable } from "./question";
import { InterviewTable } from "./interview";

export const experienceLevel = ["junior", "mid-level", "senior"] as const;

export type ExperienceLevel = (typeof experienceLevel)[number];
export const experienceLevelEnum = pgEnum(
  "job_info_experience_level",
  experienceLevel,
);

export const jobInfoTable = pgTable("job_info", {
  id,
  title: varchar(),
  name: varchar().notNull(),
  experienceLevel: experienceLevelEnum().notNull(),
  description: varchar().notNull(),
  userId: varchar()
    .references(() => UserTable.id, { onDelete: "cascade" })
    .notNull(),
  createdAt,
  updatedAt,
});

export const JobInfoRelations = relations(jobInfoTable, ({ one, many }) => ({
  user: one(UserTable, {
    fields: [jobInfoTable.userId],
    references: [UserTable.id],
  }),
  questions: many(QuestionTable, { relationName: "jobInfo_questions" }),
  interviews: many(InterviewTable, { relationName: "jobInfo_interviews" }),
}));
