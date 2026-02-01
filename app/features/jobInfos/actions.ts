"use server";

import { jobInfoSchema } from "./schema";
import { z } from "zod";
import { getCurrentUser } from "../../services/clerk/lib/getCurrentUser";
import { redirect } from "next/navigation";
import { insertJobInfo, updateJobInfo as updateJobInfoDb } from "./db";
import { and, eq } from "drizzle-orm";
import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { cacheTag } from "next/cache";
import { getJobInfoIdTag } from "./dbCache";

export async function createJobInfo(unsafeData: z.infer<typeof jobInfoSchema>) {
  const { userId } = await getCurrentUser();

  if (userId == null) {
    throw new Error("User not authenticated");
  }

  const { success, data } = jobInfoSchema.safeParse(unsafeData);
  if (!success) {
    throw new Error("Invalid job data");
  }

  const jobInfo = await insertJobInfo({ ...data, userId });

  redirect(`/app/job-infos/${jobInfo.id}`);
}

export async function updateJobInfo(
  id: string,
  unsafeData: z.infer<typeof jobInfoSchema>,
) {
  const { userId } = await getCurrentUser();

  if (userId == null) {
    return {
      error: true,
      message: "You don't have permission to do this",
    };
  }

  const { success, data } = jobInfoSchema.safeParse(unsafeData);

  if (!success) {
    return {
      error: true,
      message: "Invalid job data",
    };
  }
  const existingJobInfo = await getJobInfo(id, userId);

  if (existingJobInfo == null) {
    return {
      error: true,
      message: "Job info not found",
    };
  }

  const jobInfo = await updateJobInfoDb(id, data);

  redirect(`/app/job-infos/${jobInfo.id}`);
}

async function getJobInfo(id: string, userId: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));
  return db.query.jobInfoTable.findFirst({
    where: and(eq(jobInfoTable.id, id), eq(jobInfoTable.userId, userId)),
  });
}
