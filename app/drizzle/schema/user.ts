import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "../schemaHelper";
import { relations } from "drizzle-orm";
import { jobInfoTable } from "./jobInfo";

export const UserTable = pgTable("users", {
  id: varchar().primaryKey(),
  email: varchar().notNull().unique(),
  name: varchar().notNull(),
  imageUrl: varchar().notNull(),
  // Observability and messaging ONLY. auth().has() remains the authoritative
  // entitlement check - it is always live and never over-grants. These two
  // columns exist so a past_due or cancelled subscription can be surfaced to
  // the user, and so we have a record that the event arrived at all.
  subscriptionStatus: varchar({ length: 50 }),
  subscriptionUpdatedAt: timestamp({ withTimezone: true }),
  createdAt,
  updatedAt,
});

export const UserRelations = relations(UserTable, ({ many }) => ({
  jobInfos: many(jobInfoTable),
}));
