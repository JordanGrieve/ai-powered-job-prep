import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "../schemaHelper";
import { relations } from "drizzle-orm";
import { jobInfoTable } from "./jobInfo";

export const UserTable = pgTable("users", {
  id: varchar().primaryKey(),
  // NOT unique, deliberately. The identity here is the Clerk id above; email
  // is a denormalised copy of what Clerk holds, kept so the app can show and
  // contact the user without a round trip.
  //
  // It used to be unique, and that locked real people out. A leftover row -
  // from a failed user.deleted webhook, a Clerk instance being replaced, or a
  // user deleting their account and coming back - still held the address. The
  // next sign-up with that email hit users_email_unique, provisioning failed,
  // and /onboarding spun forever with nothing to explain it and no way for
  // the user to recover. That happened three times during setup.
  //
  // Clerk already enforces one account per email. Duplicating that rule here
  // bought nothing and turned a stale row into a permanent lockout.
  email: varchar().notNull(),
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
