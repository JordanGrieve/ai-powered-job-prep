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
import Link from "next/link";

const options = [
  {
    label: "Answer Technical Questions",
    description:
      "Challange yourself with practive questions tailortred to your job description",
    href: "questions",
  },
  {
    label: "Practice Interviewing",
    description:
      "Simulate a real interview with an AI interviewer that ask questions based on your job description",
    href: "interviews",
  },
  {
    label: "Refine your resume",
    description:
      "Get personalized feedback on how to improve your resume based on your job description",
    href: "resume",
  },
  {
    label: "Update job description",
    description:
      "This should only be used for minior updates to your job description. For major changes, we recommend creating a new job description to keep track of your progress over time.",
    href: "edit",
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
      if (jobInfo == null) throw new Error("Job info not found");
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
          {options.map((option) => (
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
          ))}
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
