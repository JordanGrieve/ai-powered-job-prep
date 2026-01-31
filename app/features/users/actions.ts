"use cache";
import { cacheTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/app/drizzle/db";
import { UserTable } from "@/app/drizzle/schema/user";
import { getUserIdTag } from "@/app/features/users/dbCache";

export async function getUser(id: string) {
  cacheTag(getUserIdTag(id));

  return db.query.UserTable.findFirst({
    where: eq(UserTable.id, id),
  });
}
