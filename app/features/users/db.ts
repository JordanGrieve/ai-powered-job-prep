import { db } from "../../drizzle/db";
import { UserTable } from "../../drizzle/schema/user";
import { eq } from "drizzle-orm";

export async function upsertUser(user: typeof UserTable.$inferInsert) {
  await db
    .insert(UserTable)
    .values(user)
    .onConflictDoUpdate({
      target: [UserTable.id],
      set: user,
    });
}
export async function deleteUser(id: string) {
  await db.delete(UserTable).where(eq(UserTable.id, id));
}
