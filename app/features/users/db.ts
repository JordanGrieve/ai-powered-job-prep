import { db } from "../../drizzle/db";
import { UserTable } from "../../drizzle/schema/user";
import { eq } from "drizzle-orm";
import { revalidateUserCache } from "./dbCache";
import { getJobInfoGlobalTag, getJobInfoUserTag } from "../jobInfos/dbCache";
import { revalidateTag } from "next/cache";

export async function upsertUser(user: typeof UserTable.$inferInsert) {
  await db
    .insert(UserTable)
    .values(user)
    .onConflictDoUpdate({
      target: [UserTable.id],
      set: user,
    });

  revalidateUserCache(user.id);
}

/**
 * Records a Clerk Billing lifecycle change. Deliberately does NOT gate access -
 * auth().has() is the authoritative entitlement check and is always live. This
 * exists so a past_due or cancelled subscription can be surfaced in the UI, and
 * so there is a record that the event arrived.
 */
export async function recordSubscriptionStatus(
  userId: string,
  status: string,
  occurredAt: Date,
) {
  const [updated] = await db
    .update(UserTable)
    .set({ subscriptionStatus: status, subscriptionUpdatedAt: occurredAt })
    .where(eq(UserTable.id, userId))
    .returning({ id: UserTable.id });

  if (updated == null) return null;

  revalidateUserCache(userId);
  return updated;
}

export async function deleteUser(id: string) {
  await db.delete(UserTable).where(eq(UserTable.id, id));

  revalidateUserCache(id);
  // Job infos (and their interviews/questions) are cascade-deleted along with
  // the user, so their cached reads have to be dropped too.
  revalidateTag(getJobInfoGlobalTag(), "default");
  revalidateTag(getJobInfoUserTag(id), "default");
}
