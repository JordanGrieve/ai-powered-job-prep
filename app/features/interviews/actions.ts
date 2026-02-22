"use server";

import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { getJobInfoIdTag } from "../jobInfos/dbCache";
import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { and, eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { insertInterview, updateInterview as updateInterviewDb } from "./db";
import { getInterviewIdTag } from "./dbCache";
import { InterviewTable } from "@/app/drizzle/schema/interview";
import { canCreateInterview } from "./permissions";
import { PLAN_LIMIT_MESSAGE } from "@/lib/errorToast";
import arcjet, { tokenBucket, request } from "@arcjet/next";
import { env } from "@/app/data/env/server";
import { generateAiInterviewFeedback } from "@/app/services/ai/interviews";

const aj = arcjet({
  characteristics: ["userId"],
  key: env.ARCJET_KEY,
  rules: [
    tokenBucket({
      capacity: 12,
      refillRate: 4,
      interval: "1d",
      mode: "LIVE",
    }),
  ],
});

export async function createInterview({
  jobInfoId,
}: {
  jobInfoId: string;
}): Promise<{ error: true; message: string } | { error: false; id: string }> {
  const { userId } = await getCurrentUser();

  if (userId == null) {
    return {
      error: true,
      message: "Unauthorized access. Please sign in to start an interview.",
    };
  }

  // Permissions
  if (!(await canCreateInterview())) {
    return {
      error: true,
      message: PLAN_LIMIT_MESSAGE,
    };
  }

  // Rate limit
  const decision = await aj.protect(await request(), { userId, requested: 1 });

  // job info
  const jobInfo = await getJobInfo(jobInfoId, userId);
  if (jobInfo == null) {
    return {
      error: true,
      message: "Unauthorized access. Please sign in to start an interview.",
    };
  }

  if (decision.isDenied()) {
    return {
      error: true,
      message: PLAN_LIMIT_MESSAGE,
    };
  }

  // Create interview
  const interview = await insertInterview({ jobInfoId, duration: "00:00:00" });

  return { error: false, id: interview.id };
}

export async function updateInterview(
  id: string,
  data: {
    humeChatId?: string;
    duration?: string;
  },
) {
  const { userId } = await getCurrentUser();

  if (userId == null) {
    return {
      error: true,
      message: "You don't have permission to do this",
    };
  }

  const interview = await getInterview(id, userId);
  if (interview == null) {
    return {
      error: true,
      message: "You don't have permission to do this",
    };
  }
  await updateInterviewDb(id, data);

  return { error: false };
}

export async function generateInterviewFeedback(interviewId: string) {
  const { userId, user } = await getCurrentUser({ allData: true });
  if (userId == null || user == null) {
    return {
      error: true,
      message: "You don't have permission to do this",
    };
  }

  const interview = await getInterview(interviewId, userId);
  if (interview == null) {
    return {
      error: true,
      message: "You don't have permission to do this",
    };
  }

  if (interview.humeChatId == null) {
    return {
      error: true,
      message: "Feedback can't be generated for this interview",
    };
  }

  const feedback = await generateAiInterviewFeedback({
    humeChatId: interview.humeChatId,
    jobInfo: interview.jobInfo,
    userName: user.name,
  });

  if (feedback == null) {
    return {
      error: true,
      message: "Failed to generate feedback. Please try again.",
    };
  }

  await updateInterviewDb(interviewId, { feedback });

  return { error: false };
}

async function getJobInfo(id: string, userId: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));

  return db.query.jobInfoTable.findFirst({
    where: and(eq(jobInfoTable.id, id), eq(jobInfoTable.userId, userId)),
  });
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
          description: true,
          experienceLevel: true,
          title: true,
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
