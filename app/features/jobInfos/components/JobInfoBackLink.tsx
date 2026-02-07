import BackLink from "@/components/BackLink";
import { cn } from "@/lib/utils";
import { cacheTag } from "next/cache";
import { Suspense } from "react";
import { getJobInfoIdTag } from "../dbCache";
import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { eq } from "drizzle-orm";

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
  const jobInfo = await getJobInfo(jobInfoId);

  return jobInfo?.name ?? "Job Description";
}

async function getJobInfo(id: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));

  return db.query.jobInfoTable.findFirst({
    where: eq(jobInfoTable.id, id),
  });
}
