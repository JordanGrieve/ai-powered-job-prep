import BackLink from "@/components/BackLink";
import { cn } from "@/lib/utils";
import { cacheTag } from "next/cache";
import { Suspense } from "react";
import { getJobInfoIdTag } from "../dbCache";
import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";

export function JobInfoBackLink({
  jobInfoId,
  className,
}: {
  jobInfoId: string;
  className?: string;
}) {
  return (
    <BackLink
      href={`/app/job-infos/${jobInfoId}`}
      className={cn("mb-4", className)}
    >
      <Suspense fallback="Job Description">
        <JobName jobInfoId={jobInfoId} />
      </Suspense>
    </BackLink>
  );
}

async function JobName({ jobInfoId }: { jobInfoId: string }) {
  // This link renders outside the Suspense boundary that performs the
  // ownership check, so without scoping the query here the job name of
  // another user's record streams to anyone holding its UUID.
  const { userId } = await getCurrentUser();
  if (userId == null) return "Job Description";

  const jobInfo = await getJobInfo(jobInfoId, userId);

  return jobInfo?.name ?? "Job Description";
}

// userId is a parameter rather than a closure read so it forms part of the
// "use cache" key and one user's result cannot be served to another.
async function getJobInfo(id: string, userId: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));

  return db.query.jobInfoTable.findFirst({
    where: and(eq(jobInfoTable.id, id), eq(jobInfoTable.userId, userId)),
  });
}
