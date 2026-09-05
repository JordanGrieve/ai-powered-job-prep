import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { getQuestions } from "@/app/features/questions/actions";
import {
  canCreateQuestion,
  getQuestionUsage,
} from "@/app/features/questions/permissions";
import { JobInfoBackLink } from "@/app/features/jobInfos/components/JobInfoBackLink";
import { getJobInfoIdTag } from "@/app/features/jobInfos/dbCache";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { and, eq } from "drizzle-orm";
import { Loader2 } from "lucide-react";
import { cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { JobInfoParams } from "@/app/app/job-infos/[jobinfoid]/params";
import { QuestionsClient } from "./_client";

// Question generation and answer review are Gemini calls made from this
// segment; each self-aborts at 60s.
export const maxDuration = 90;

export default function QuestionsPage({ params }: { params: JobInfoParams }) {
  return (
    <div className="container py-4 space-y-4">
      <JobInfoBackLink params={params} />
      <Suspense
        fallback={<Loader2 className="animate-spin size-24 mx-auto my-24" />}
      >
        <SuspendedPage params={params} />
      </Suspense>
    </div>
  );
}

async function SuspendedPage({ params }: { params: JobInfoParams }) {
  const { jobinfoid: jobInfoId } = await params;
  const { userId, redirectToSignIn } = await getCurrentUser();
  if (userId == null) return redirectToSignIn();

  const jobInfo = await getJobInfo(jobInfoId, userId);
  if (jobInfo == null) return notFound();

  const [questions, canGenerate, usage] = await Promise.all([
    getQuestions(jobInfoId),
    canCreateQuestion(),
    getQuestionUsage(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-4xl">Practice questions</h1>
        <p className="text-sm text-muted-foreground">
          {usage.isUnlimited ? (
            "Unlimited questions on your current plan."
          ) : (
            <>
              {usage.used} of {usage.limit ?? 0} questions used.{" "}
              <Link href="/app/upgrade" className="underline underline-offset-4">
                {canGenerate ? "View plans" : "Upgrade to continue"}
              </Link>
            </>
          )}
        </p>
      </div>

      <QuestionsClient
        jobInfoId={jobInfoId}
        initialQuestions={questions.map((q) => ({
          id: q.id,
          text: q.text,
          difficulty: q.difficulty,
          answer: q.answer,
          feedback: q.feedback,
          rating: q.rating,
        }))}
        canGenerate={canGenerate}
      />
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
