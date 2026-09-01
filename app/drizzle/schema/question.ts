import {
  index,
  integer,
  pgTable,
  varchar,
  pgEnum,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
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
    // Practice history. All three are null until the candidate submits an
    // answer - a generated-but-unanswered question is a normal resting state.
    // Bound matches the 10k cap the action already enforces on input.
    answer: varchar({ length: 10000 }),
    feedback: varchar(),
    // 1-10. The whole point of persisting this is that progress needs a
    // NUMBER; markdown prose cannot be charted.
    rating: integer(),
    answeredAt: timestamp({ withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("question_job_id_idx").on(table.jobId),
    // Powers the progress query: answered questions for a job info, in order.
    index("question_job_id_answered_at_idx").on(table.jobId, table.answeredAt),
  ],
);

export const questionRelations = relations(QuestionTable, ({ one }) => ({
  jobInfo: one(jobInfoTable, {
    fields: [QuestionTable.jobId],
    references: [jobInfoTable.id],
    relationName: "jobInfo_questions",
  }),
}));
