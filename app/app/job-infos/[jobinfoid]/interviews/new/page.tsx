import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema";
import { getJobInfoIdTag } from "@/app/features/jobInfos/dbCache";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { and, eq } from "drizzle-orm";
import { Loader2Icon } from "lucide-react";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fetchAccessToken } from "hume";
import { env } from "@/app/data/env/server";
import { VoiceProvider } from "@humeai/voice-react";
import { StartCall } from "./_StartCall";

export default async function NewInterviewPage({
  params,
}: {
  params: Promise<{ jobinfoid: string }>;
}) {
  const { jobinfoid: jobInfoId } = await params;
  return (
    <Suspense
      fallback={
        <div className="h-screen-header flex items-center justify-center">
          <Loader2Icon className="animate-spin size-24" />
        </div>
      }
    >
      <SuspendedComponent jobInfoId={jobInfoId} />
    </Suspense>
  );
}

async function SuspendedComponent({ jobInfoId }: { jobInfoId: string }) {
  const { userId, redirectToSignIn, user } = await getCurrentUser({
    allData: true,
  });
  if (userId == null || user == null) return redirectToSignIn();

  const jobInfo = await getJobInfo(jobInfoId, userId);
  if (jobInfo == null) return notFound();

  const accessToken = await fetchAccessToken({
    apiKey: env.HUME_API_KEY,
    secretKey: env.HUME_SECRET_KEY,
  });

  return (
    <VoiceProvider>
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
