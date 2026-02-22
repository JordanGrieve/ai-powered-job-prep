import { db } from "@/app/drizzle/db";
import { InterviewTable } from "@/app/drizzle/schema";
import { getInterviewIdTag } from "@/app/features/interviews/dbCache";
import { getJobInfoIdTag } from "@/app/features/jobInfos/dbCache";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { CondensedMessages } from "@/app/services/hume/components/CondensedMessages";
import { fetchChatMessages } from "@/app/services/hume/lib/api";
import { condenseChatMessages } from "@/app/services/hume/lib/condensedChatMessages";
import BackLink from "@/components/BackLink";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Skeleton, SkeletonButton } from "@/components/Skeleton";
import { SuspendedItem } from "@/components/SuspendedItem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/formatters";
import { eq } from "drizzle-orm";
import { Loader2Icon } from "lucide-react";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ jobInfoId: string; interviewId: string }>;
}) {
  const { jobInfoId, interviewId } = await params;

  const interview = getCurrentUser().then(
    async ({ userId, redirectToSignIn }) => {
      if (userId == null) return redirectToSignIn();

      const interview = await getInterview(interviewId, userId);
      if (interview == null) return notFound();
      return interview;
    },
  );

  return (
    <div className="container my-4 space-y-4">
      <BackLink href={`/app/job-infos/${jobInfoId}/interviews`}>
        All Interviews
      </BackLink>
      <div className="space-y-6">
        <div className="flex gap-2 justify-between">
          <div className="space-y-2 mb-6">
            <h1 className="text-3xl md:text-4xl">
              Interview:
              <SuspendedItem
                item={interview}
                fallback={<Skeleton className="w-48" />}
                result={(interview) =>
                  ` ${formatDateTime(interview.createdAt)}`
                }
              ></SuspendedItem>
            </h1>
            <p className="text-muted-foreground">
              <SuspendedItem
                item={interview}
                fallback={<Skeleton className="w-28" />}
                result={(interview) => interview.duration}
              ></SuspendedItem>
            </p>
          </div>
          <SuspendedItem
            item={interview}
            fallback={<SkeletonButton className="w-32" />}
            result={(interview) =>
              interview.feedback == null ? (
                <p>test</p>
              ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">View Feedback</Button>
                  </DialogTrigger>
                  <DialogContent className="md:max-w-3xl lg:max-w-4xl max-h-[calc(100%-2rem)] overflow-y-auto flex flex-col">
                    <DialogTitle>Feedback</DialogTitle>
                    <MarkdownRenderer>{interview.feedback}</MarkdownRenderer>
                  </DialogContent>
                </Dialog>
              )
            }
          />
        </div>
        <Suspense
          fallback={<Loader2Icon className="animate-spin size-24 mx-auto" />}
        >
          <Messages interview={interview} />
        </Suspense>
      </div>
    </div>
  );
}

async function Messages({
  interview,
}: {
  interview: Promise<{ humeChatId: string | null }>;
}) {
  const { user, redirectToSignIn } = await getCurrentUser({ allData: true });
  if (user == null) return redirectToSignIn();

  const { humeChatId } = await interview;
  if (humeChatId == null) return notFound();

  const condensedMessages = condenseChatMessages(
    await fetchChatMessages(humeChatId),
  );

  return (
    <CondensedMessages
      messages={condensedMessages}
      user={user}
      className="max-w-5xl mx-auto"
    />
  );
}

async function getInterview(id: string, userId: string) {
  "use cache";
  cacheTag(getInterviewIdTag(id));

  const interview = await db.query.InterviewTable.findFirst({
    where: eq(InterviewTable.id, id),
    with: {
      jobInfo: {
        columns: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (interview == null) return null;

  cacheTag(getJobInfoIdTag(interview.jobInfo.id));
  if (interview.jobInfo.userId !== userId) {
    return null;
  }
  return interview;
}
