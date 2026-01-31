import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/app/drizzle/db";
import { UserTable } from "@/app/drizzle/schema/user";
import { cacheTag } from "next/cache";
import { getUserIdTag } from "@/app/features/users/dbCache";

export async function getCurrentUser({ allData = false } = {}) {
  const { userId, redirectToSignIn } = await auth();

  return {
    userId,
    redirectToSignIn,
    user: allData && userId != null ? await getUser(userId) : null,
  };
}
async function getUser(id: string) {
  "use cache";
  cacheTag(getUserIdTag(id));
  return db.query.UserTable.findFirst({
    where: eq(UserTable.id, id),
  });
}
