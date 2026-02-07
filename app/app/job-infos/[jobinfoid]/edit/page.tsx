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
import { Suspense } from "react";

export default async function JobInfoNewPage({
  params,
}: {
  params: Promise<{ jobinfoid: string }>;
}) {
  const { jobinfoid } = await params;

  return (
    <div className="container my-4 max-w-5xl space-y-4">
      <JobInfoBackLink jobInfoId={jobinfoid} />
      <h1 className="text-3xl md:text-4xl">Edit Job Description</h1>

      <Card>
        <CardContent>
          <Suspense
            fallback={<Loader2 className="animate-spin size-24 mx-auto" />}
          >
            <SuspendedForm jobInfoId={jobinfoid} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function SuspendedForm({ jobInfoId }: { jobInfoId: string }) {
  const { userId, redirectToSignIn } = await getCurrentUser();
  if (userId == null) return redirectToSignIn();

  const jobInfo = await getJobInfo(jobInfoId, userId);
  if (jobInfo == null) throw new Error("Job info not found");

  return <JobInfoForm jobInfo={jobInfo} />;
}

async function getJobInfo(id: string, userId: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));

  return db.query.jobInfoTable.findFirst({
    where: and(eq(jobInfoTable.id, id), eq(jobInfoTable.userId, userId)),
  });
}
