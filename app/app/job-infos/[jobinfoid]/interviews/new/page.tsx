import type { JobInfoParams } from "@/app/app/job-infos/[jobinfoid]/params";
import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema";
import { getJobInfoIdTag } from "@/app/features/jobInfos/dbCache";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { and, eq } from "drizzle-orm";
import { Loader2Icon } from "lucide-react";
import { cacheTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { fetchAccessToken } from "hume";
import { env } from "@/app/data/env/server";
import { VoiceProvider } from "@humeai/voice-react";
import { StartCall } from "./_StartCall";
import { canCreateInterview } from "@/app/features/interviews/permissions";
import type { Metadata } from "next";

// The root layout applies a "%s · Callback" template. Without this every
// signed-in page shared one generic title, which is WCAG 2.4.2 and makes
// browser tabs and history entries indistinguishable.
export const metadata: Metadata = { title: "New interview" };

export default function NewInterviewPage({
  params,
}: {
  params: JobInfoParams;
}) {
  return (
    <Suspense
      fallback={
        <div className="h-screen-header flex items-center justify-center">
          <Loader2Icon className="animate-spin size-24" />
        </div>
      }
    >
      <SuspendedComponent params={params} />
    </Suspense>
  );
}

async function SuspendedComponent({ params }: { params: JobInfoParams }) {
  const { jobinfoid: jobInfoId } = await params;
  const { userId, redirectToSignIn, user } = await getCurrentUser({
    allData: true,
  });
  if (userId == null || user == null) return redirectToSignIn();

  // Deliberately NOT caught: a PermissionCheckError here reaches the error
  // boundary and says "something went wrong", which is true. Redirecting to
  // /app/upgrade on a database fault is the exact bug this replaced - it told
  // paying customers they were out of quota.
  if (!(await canCreateInterview())) return redirect("/app/upgrade");

  const jobInfo = await getJobInfo(jobInfoId, userId);
  if (jobInfo == null) return notFound();

  const accessToken = await fetchAccessToken({
    apiKey: env.HUME_API_KEY,
    secretKey: env.HUME_SECRET_KEY,
  });

  return (
    <VoiceProvider>
      {/* This page had no heading at all in any of its three states, so
          screen reader users landed on it with nothing to orient by.
          Rendered here rather than inside StartCall because that component
          returns a different tree per connection state and would otherwise
          need the same heading in each one. sr-only because the visual
          design deliberately leads with the Start button. */}
      <h1 className="sr-only">Practice interview</h1>
      <StartCall jobInfo={jobInfo} accessToken={accessToken} user={user} />
    </VoiceProvider>
  );
}

async function getJobInfo(id: string, userId: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));

  return db.query.jobInfoTable.findFirst({
    where: and(eq(jobInfoTable.id, id), eq(jobInfoTable.userId, userId)),
  });
}
