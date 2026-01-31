"use server";

import { jobInfoSchema } from "./schema";
import { z } from "zod";
import { getCurrentUser } from "../../services/clerk/lib/getCurrentUser";
import { redirect } from "next/navigation";

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
