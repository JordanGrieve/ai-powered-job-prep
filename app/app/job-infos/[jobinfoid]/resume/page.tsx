import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { JobInfoBackLink } from "@/app/features/jobInfos/components/JobInfoBackLink";
import { getJobInfoIdTag } from "@/app/features/jobInfos/dbCache";
import { canRunResumeAnalysis } from "@/app/features/resume/permissions";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { and, eq } from "drizzle-orm";
import { Loader2 } from "lucide-react";
import { cacheTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ResumeClient } from "./_client";

export const metadata = { title: "Resume" };

// The Gemini call sends a whole document and self-aborts at 90s.
export const maxDuration = 120;

export default async function ResumePage({
  params,
}: {
  params: Promise<{ jobinfoid: string }>;
}) {
  const { jobinfoid } = await params;

  return (
    <div className="container py-4 space-y-4 max-w-3xl">
      <JobInfoBackLink jobInfoId={jobinfoid} />
      <Suspense
        fallback={<Loader2 className="animate-spin size-24 mx-auto my-24" />}
      >
        <SuspendedPage jobInfoId={jobinfoid} />
      </Suspense>
    </div>
  );
}

async function SuspendedPage({ jobInfoId }: { jobInfoId: string }) {
  const { userId, redirectToSignIn } = await getCurrentUser();
  if (userId == null) return redirectToSignIn();

  const jobInfo = await getJobInfo(jobInfoId, userId);
  if (jobInfo == null) return notFound();

  // Gated in BOTH places, as required: here for the page, and independently
  // inside the server action - which is what actually stops a direct POST.
  if (!(await canRunResumeAnalysis())) return redirect("/app/upgrade");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-4xl">Refine your resume</h1>
        <p className="text-muted-foreground">
          Upload your resume and get feedback on it against this specific role.
        </p>
      </div>

      <ResumeClient jobInfoId={jobInfoId} />
    </div>
  );
}

async function getJobInfo(id: string, userId: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));

  return db.query.jobInfoTable.findFirst({
    where: and(eq(jobInfoTable.id, id), eq(jobInfoTable.userId, userId)),
  });
}
