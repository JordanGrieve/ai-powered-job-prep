import { index, pgTable, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "../schemaHelper";
import { relations } from "drizzle-orm";
import { UserTable } from "./user";
import { QuestionTable } from "./question";
import { InterviewTable } from "./interview";
import { ResumeAnalysisTable } from "./resumeAnalysis";

export const experienceLevel = ["junior", "mid-level", "senior"] as const;

export type ExperienceLevel = (typeof experienceLevel)[number];
export const experienceLevelEnum = pgEnum(
  "job_info_experience_level",
  experienceLevel,
);

export const jobInfoTable = pgTable(
  "job_info",
  {
    id,
    title: varchar({ length: 200 }),
    name: varchar({ length: 200 }).notNull(),
    experienceLevel: experienceLevelEnum().notNull(),
    // Bounded because this is billed on every Gemini call and shipped to Hume
    // as a session variable on every interview start.
    description: varchar({ length: 10000 }).notNull(),
    userId: varchar()
      .references(() => UserTable.id, { onDelete: "cascade" })
      .notNull(),
    createdAt,
    updatedAt,
  },
  // Postgres does not index foreign keys automatically. This one is read by the
  // dashboard list and the plan-limit count, and scanned on every user delete.
  (table) => [index("job_info_user_id_idx").on(table.userId)],
);

export const JobInfoRelations = relations(jobInfoTable, ({ one, many }) => ({
  user: one(UserTable, {
    fields: [jobInfoTable.userId],
    references: [UserTable.id],
  }),
  questions: many(QuestionTable, { relationName: "jobInfo_questions" }),
  interviews: many(InterviewTable, { relationName: "jobInfo_interviews" }),
  resumeAnalyses: many(ResumeAnalysisTable, {
    relationName: "jobInfo_resumeAnalyses",
  }),
}));
