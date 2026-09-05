import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { JobInfoBackLink } from "@/app/features/jobInfos/components/JobInfoBackLink";
import { JobInfoForm } from "@/app/features/jobInfos/components/JobInfoForm";
import { getJobInfoIdTag } from "@/app/features/jobInfos/dbCache";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { and, eq } from "drizzle-orm";
import { Loader2 } from "lucide-react";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { JobInfoParams } from "@/app/app/job-infos/[jobinfoid]/params";

export default function JobInfoNewPage({ params }: { params: JobInfoParams }) {
  return (
    <div className="container my-4 max-w-5xl space-y-4">
      <JobInfoBackLink params={params} />
      <h1 className="text-3xl md:text-4xl">Edit Job Description</h1>

      <Card>
        <CardContent>
          <Suspense
            fallback={<Loader2 className="animate-spin size-24 mx-auto" />}
          >
            <SuspendedForm params={params} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function SuspendedForm({ params }: { params: JobInfoParams }) {
  const { jobinfoid: jobInfoId } = await params;
  const { userId, redirectToSignIn } = await getCurrentUser();
  if (userId == null) return redirectToSignIn();

  const jobInfo = await getJobInfo(jobInfoId, userId);
  if (jobInfo == null) return notFound();

  return <JobInfoForm jobInfo={jobInfo} />;
}

async function getJobInfo(id: string, userId: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));

  return db.query.jobInfoTable.findFirst({
    where: and(eq(jobInfoTable.id, id), eq(jobInfoTable.userId, userId)),
  });
}
