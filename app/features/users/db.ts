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

export async function deleteUser(id: string) {
  await db.delete(UserTable).where(eq(UserTable.id, id));

  revalidateUserCache(id);
  // Job infos (and their interviews/questions) are cascade-deleted along with
  // the user, so their cached reads have to be dropped too.
  revalidateTag(getJobInfoGlobalTag(), "default");
  revalidateTag(getJobInfoUserTag(id), "default");
}
