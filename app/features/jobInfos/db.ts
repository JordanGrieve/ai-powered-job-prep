import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "../../drizzle/schema";
import {
  getJobInfoGlobalTag,
  getJobInfoIdTag,
  getJobInfoUserTag,
} from "./dbCache";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";

function revalidateJobInfoCache({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  revalidateTag(getJobInfoGlobalTag());
  revalidateTag(getJobInfoUserTag(userId));
  revalidateTag(getJobInfoIdTag(id));
}

export async function insertJobInfo(jobInfo: typeof jobInfoTable.$inferInsert) {
  const [newJobInfo] = await db.insert(jobInfoTable).values(jobInfo).returning({
    id: jobInfoTable.id,
    userId: jobInfoTable.userId,
  });

  revalidateJobInfoCache(newJobInfo);

  return newJobInfo;
}

export async function updateJobInfo(
  id: string,
  jobInfo: Partial<typeof jobInfoTable.$inferInsert>,
) {
  const [updatedJobInfo] = await db
    .update(jobInfoTable)
    .set(jobInfo)
    .where(eq(jobInfoTable.id, id))
    .returning({
      id: jobInfoTable.id,
      userId: jobInfoTable.userId,
    });

  revalidateJobInfoCache(updatedJobInfo);

  return updatedJobInfo;
}
``;
