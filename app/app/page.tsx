import { ArrowRightIcon, Loader2Icon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "../services/clerk/lib/getCurrentUser";
import { db } from "../drizzle/db";
import { jobInfoTable } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { getJobInfoUserTag } from "../features/jobInfos/dbCache";
import { cacheTag } from "next/cache";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JobInfoForm } from "../features/jobInfos/components/JobInfoForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { getInterviewUsage } from "../features/interviews/permissions";

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
  const { userId, user, redirectToSignIn } = await getCurrentUser({
    allData: true,
  });
  if (userId == null) return redirectToSignIn();
  // The Clerk webhook writes the users row. Until it lands, an insert would
  // hit a foreign-key violation, so hold the user on /onboarding.
  if (user == null) return redirect("/onboarding");

  const [jobInfos, usage] = await Promise.all([
    getJobInfos(userId),
    getInterviewUsage(),
  ]);

  if (jobInfos.length === 0) {
    return <NoJobInfos />;
  }
  return (
    <div className="container my-4">
      <div className="flex gap-2 justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl; lg:text-5xl mb-4">
            Select a job description
          </h1>
          <InterviewUsage usage={usage} />
        </div>
        <Button asChild>
          <Link href="/app/job-infos/new">
            <PlusIcon />
            Create Job Description
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-col-3 gap-6 has-hover:*:not-hover:opacity-70">
        {jobInfos.map((jobInfo) => (
          <Link
            className="hover:scale-[1.02] transition-[transform_opacity]"
            href={`/app/job-infos/${jobInfo.id}`}
            key={jobInfo.id}
          >
            <Card className="h-full">
              <div className="flex items-center justify-between h-full">
                <div className="space-y-4 h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{jobInfo.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {jobInfo.description}
                    </p>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Badge variant="outline">{jobInfo.experienceLevel}</Badge>
                    {jobInfo.title && (
                      <Badge variant="outline">{jobInfo.title}</Badge>
                    )}
                  </CardFooter>
                </div>
                <CardContent>
                  <ArrowRightIcon className="size-6" />
                </CardContent>
              </div>
            </Card>
          </Link>
        ))}
        {/* Create New Job */}
        <Link className="transition-opacity" href="/app/job-infos/new">
          <Card className="h-full flex items-center justify-center border-dashed border-3 bg-transparent hover:border-primary/50 transition-colors shadow-none">
            <div className="text-lg flex items-center gap-2">
              <PlusIcon className="size-6" />
              New Job Description
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}

// Tell the user where they stand BEFORE they commit to starting an interview,
// rather than redirecting them to /app/upgrade after the fact.
function InterviewUsage({
  usage,
}: {
  usage: { used: number; limit: number | null; isUnlimited: boolean };
}) {
  if (usage.isUnlimited) {
    return (
      <p className="text-sm text-muted-foreground">
        Unlimited interviews on your current plan.
      </p>
    );
  }

  const exhausted = usage.limit != null && usage.used >= usage.limit;

  return (
    <p className="text-sm text-muted-foreground">
      {usage.used} of {usage.limit ?? 0} interviews used.{" "}
      <Link
        href="/app/upgrade"
        className={`underline underline-offset-4 ${
          exhausted ? "text-foreground" : ""
        }`}
      >
        {exhausted ? "Upgrade to continue" : "View plans"}
      </Link>
    </p>
  );
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
