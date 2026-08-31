import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { getJobInfoIdTag } from "@/app/features/jobInfos/dbCache";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import BackLink from "@/components/BackLink";
import { Skeleton } from "@/components/Skeleton";
import { SuspendedItem } from "@/components/SuspendedItem";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { and, eq } from "drizzle-orm";
import { ArrowRightIcon } from "lucide-react";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";

// `comingSoon` entries render as a visibly disabled card that does not
// navigate. There is no questions/ or resume/ route segment yet, and nothing
// intercepts the miss - no catch-all, no rewrites - so linking to them landed
// the user on Next's default unstyled 404, which reads as a crash. This is the
// most reachable surface in the app.
const options = [
  {
    label: "Answer Technical Questions",
    description:
      "Challenge yourself with practice questions tailored to your job description",
    href: "questions",
    comingSoon: true,
  },
  {
    label: "Practice Interviewing",
    description:
      "Simulate a real interview with an AI interviewer that asks questions based on your job description",
    href: "interviews",
    comingSoon: false,
  },
  {
    label: "Refine your resume",
    description:
      "Get personalized feedback on how to improve your resume based on your job description",
    href: "resume",
    comingSoon: true,
  },
  {
    label: "Update job description",
    description:
      "This should only be used for minor updates to your job description. For major changes, we recommend creating a new job description to keep track of your progress over time.",
    href: "edit",
    comingSoon: false,
  },
];

export default async function JobInfoPage({
  params,
}: {
  params: Promise<{ jobinfoid: string }>;
}) {
  const { jobinfoid: jobInfoId } = await params;

  const jobInfo = getCurrentUser().then(
    async ({ userId, redirectToSignIn }) => {
      if (userId == null) return redirectToSignIn();
      const jobInfo = await getJobInfo(jobInfoId, userId);
      if (jobInfo == null) return notFound();
      return jobInfo;
    },
  );

  return (
    <div className="container my-4 space-y-4">
      <BackLink href="/app">Dashboard</BackLink>

      <div className="space-y-6">
        <header className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-3xl">
              <SuspendedItem
                item={jobInfo}
                fallback={<Skeleton className="w-48" />}
                result={(j) => j.name}
              />
            </h1>
            <div className="flex gap-2">
              <SuspendedItem
                item={jobInfo}
                fallback={<Skeleton className="w-12" />}
                result={(j) => (
                  <Badge variant="secondary">{j.experienceLevel}</Badge>
                )}
              />
              <SuspendedItem
                item={jobInfo}
                fallback={<Skeleton className="w-12" />}
                result={(j) => <Badge variant="secondary">{j.title}</Badge>}
              />
            </div>
          </div>
          <p className="text-muted-foreground line-clamp-3">
            <SuspendedItem
              item={jobInfo}
              fallback={<Skeleton className="w-96" />}
              result={(j) => j.description}
            />
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-col-3 gap-6 has-hover:*:not-hover:opacity-70">
          {options.map((option) =>
            option.comingSoon ? (
              <div
                key={option.href}
                aria-disabled="true"
                className="cursor-not-allowed opacity-60"
              >
                <Card className="h-full flex items-start justify-between flex-row">
                  <CardHeader className="grow">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {option.label}
                      <Badge variant="outline">Coming soon</Badge>
                    </CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ) : (
              <Link
                className="hover:scale-[1.02] transition-[transform_opacity]"
                href={`/app/job-infos/${jobInfoId}/${option.href}`}
                key={option.href}
              >
                <Card className="h-full flex items-start justify-between flex-row">
                  <CardHeader className="grow">
                    <CardTitle className="text-lg">{option.label}</CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ArrowRightIcon className="size-6" />
                  </CardContent>
                </Card>
              </Link>
            ),
          )}
        </div>
      </div>
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
