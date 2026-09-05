import type { InterviewParams } from "@/app/app/job-infos/[jobinfoid]/params";
import { db } from "@/app/drizzle/db";
import { InterviewTable } from "@/app/drizzle/schema";
import { generateInterviewFeedback } from "@/app/features/interviews/actions";
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
import { ActionButton } from "@/components/ui/action-button";
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

// Feedback generation runs a long-context Gemini call from this segment. The
// AI service aborts itself at 100s, comfortably inside this budget.
export const maxDuration = 120;

export default function InterviewPage({
  params,
}: {
  params: InterviewParams;
}) {
  // Chained off the params promise rather than awaited, so the page shell
  // prerenders and the existing SuspendedItem streaming still works.
  const interview = Promise.all([params, getCurrentUser()]).then(
    async ([{ interviewId }, { userId, redirectToSignIn }]) => {
      if (userId == null) return redirectToSignIn();

      const interview = await getInterview(interviewId, userId);
      if (interview == null) return notFound();
      return interview;
    },
  );

  return (
    <div className="container my-4 space-y-4">
      {/* The href needs the route param, so this link suspends on its own
          rather than forcing the whole page to wait for it. */}
      <Suspense
        fallback={<BackLink href="/app">All Interviews</BackLink>}
      >
        <InterviewsBackLink params={params} />
      </Suspense>
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
                <ActionButton
                  action={generateInterviewFeedback.bind(null, interview.id)}
                >
                  Generate Feedback
                </ActionButton>
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

async function InterviewsBackLink({ params }: { params: InterviewParams }) {
  const { jobinfoid } = await params;
  return (
    <BackLink href={`/app/job-infos/${jobinfoid}/interviews`}>
      All Interviews
    </BackLink>
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
  // A null humeChatId means the chat-id write never landed. That is a real
  // state a user can reach after a dropped connection, and a bare 404 gave
  // them no idea what happened to the call they just paid for.
  if (humeChatId == null) {
    return (
      <div className="text-center text-muted-foreground max-w-prose mx-auto space-y-2">
        <p>
          This interview never finished connecting, so there is no transcript to
          show.
        </p>
        <p>You have not been charged for it. Start a new interview to retry.</p>
      </div>
    );
  }

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
