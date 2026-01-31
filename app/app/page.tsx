import { Loader2Icon } from "lucide-react";
import { Suspense } from "react";
import { getCurrentUser } from "../services/clerk/lib/getCurrentUser";
import { db } from "../drizzle/db";
import { jobInfoTable } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { getJobInfoUserTag } from "../features/jobInfos/dbCache";
import { cacheTag } from "next/cache";
import { Card, CardContent } from "@/components/ui/card";
import { JobInfoForm } from "../features/jobInfos/components/JobInfoForm";

export default function AppPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen-header flex items-center justify-center">
          <Loader2Icon className="animate-spin size-24 " />
        </div>
      }
    >
      <JobInfos />
    </Suspense>
  );
}

async function JobInfos() {
  const { userId, redirectToSignIn } = await getCurrentUser();
  if (userId == null) return redirectToSignIn();

  const jobInfos = await getJobInfos(userId);

  if (jobInfos.length === 0) {
    return <NoJobInfos />;
  }
  return;
}

function NoJobInfos() {
  return (
    <div className="h-screen-header flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-2xl font-semibold mb-2">No Job Infos Yet</h1>
      <p className="text-muted-foreground mb-8">
        Get started by adding your first job info!
      </p>
      <Card>
        <CardContent>
          <JobInfoForm />
        </CardContent>
      </Card>
    </div>
  );
}

async function getJobInfos(userId: string) {
  "use cache";
  cacheTag(getJobInfoUserTag(userId));
  return db.query.jobInfoTable.findMany({
    where: eq(jobInfoTable.userId, userId),
    orderBy: desc(jobInfoTable.updatedAt),
  });
}
