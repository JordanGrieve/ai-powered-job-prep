import { pgTable, varchar } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "../schemaHelper";
import { relations } from "drizzle-orm";
import { jobInfoTable } from "./jobInfo";

export const UserTable = pgTable("users", {
  id: varchar().primaryKey(),
  email: varchar().notNull().unique(),
  name: varchar().notNull(),
  imageUrl: varchar().notNull(),
  createdAt,
  updatedAt,
});

export const UserRelations = relations(UserTable, ({ many }) => ({
  jobInfos: many(jobInfoTable),
}));
