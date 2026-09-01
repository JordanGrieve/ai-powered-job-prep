"use server";

import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { getJobInfoIdTag } from "../jobInfos/dbCache";
import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { and, eq } from "drizzle-orm";
import { cacheTag, revalidateTag } from "next/cache";
import { insertInterview, updateInterview as updateInterviewDb } from "./db";
import { getInterviewIdTag } from "./dbCache";
import { InterviewTable } from "@/app/drizzle/schema/interview";
import { canCreateInterview } from "./permissions";
import { PLAN_LIMIT_MESSAGE, RATE_LIMIT_MESSAGE } from "@/lib/errorToast";
import arcjet, { tokenBucket, request } from "@arcjet/next";
import { env } from "@/app/data/env/server";
import { generateAiInterviewFeedback } from "@/app/services/ai/interviews";
import { getHumeChatTag } from "@/app/services/hume/lib/cacheTags";
import { z } from "zod";

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

/**
 * Feedback generation drains the whole Hume transcript and runs a long-context
 * Gemini call, so it is by far the most expensive path in the app. It gets its
 * own, tighter bucket - the createInterview bucket above is spent by a
 * different action and gives no protection here.
 */
const feedbackAj = arcjet({
  characteristics: ["userId"],
  key: env.ARCJET_KEY,
  rules: [
    tokenBucket({
      capacity: 10,
      refillRate: 5,
      interval: "1d",
      mode: "LIVE",
    }),
  ],
});

// Server actions are public HTTP endpoints and the TypeScript signature is
// erased at runtime, so every input has to be parsed. `.strict()` is what stops
// a caller writing feedback, jobInfoId or createdAt through updateInterview.
const uuidSchema = z.string().uuid();
const updateInterviewSchema = z
  .object({
    humeChatId: z.string().uuid().optional(),
    duration: z
      .string()
      .regex(/^\d{2}:\d{2}:\d{2}$/, "duration must be HH:MM:SS")
      .optional(),
  })
  .strict();

const PERMISSION_ERROR = {
  error: true as const,
  message: "You don't have permission to do this",
};

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

  if (!uuidSchema.safeParse(jobInfoId).success) {
    return { error: true, message: "Invalid job info" };
  }

  if (!(await canCreateInterview())) {
    return { error: true, message: PLAN_LIMIT_MESSAGE };
  }

  // Ownership is checked BEFORE the rate limiter so that probing with someone
  // else's id cannot burn the caller's own token budget.
  const jobInfo = await getJobInfo(jobInfoId, userId);
  if (jobInfo == null) {
    return {
      error: true,
      message: "Unauthorized access. Please sign in to start an interview.",
    };
  }

  const decision = await aj.protect(await request(), { userId, requested: 1 });
  if (decision.isDenied()) {
    // A spent token bucket is a rate limit, not a plan limit. Returning
    // PLAN_LIMIT here sold an upgrade that could not have helped.
    return { error: true, message: RATE_LIMIT_MESSAGE };
  }

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

  if (userId == null) return PERMISSION_ERROR;
  if (!uuidSchema.safeParse(id).success) {
    return { error: true as const, message: "Invalid interview" };
  }

  const parsed = updateInterviewSchema.safeParse(data);
  if (!parsed.success) {
    return { error: true as const, message: "Invalid interview data" };
  }

  const interview = await getInterview(id, userId);
  if (interview == null) return PERMISSION_ERROR;

  if (parsed.data.humeChatId != null) {
    // humeChatId is write-once. Every Hume read uses one shared HUME_API_KEY,
    // so any chat id belonging to any user of this app would resolve - letting
    // a leaked UUID be re-pointed at your own interview and read back.
    if (interview.humeChatId != null) {
      return {
        error: true as const,
        message: "This interview has already been started",
      };
    }

    // The plan limit counts interviews with a non-null humeChatId, and
    // insertInterview writes null - so quota is consumed HERE, not at create
    // time. Without this re-check a free user could create several interviews
    // in parallel tabs while the count was still 0 and then start them all.
    if (!(await canCreateInterview())) {
      return { error: true as const, message: PLAN_LIMIT_MESSAGE };
    }
  }

  const updated = await updateInterviewDb(id, parsed.data);
  if (updated == null) {
    return { error: true as const, message: "Interview not found" };
  }

  return { error: false as const };
}

export async function generateInterviewFeedback(interviewId: string) {
  const { userId, user } = await getCurrentUser({ allData: true });
  if (userId == null || user == null) return PERMISSION_ERROR;

  if (!uuidSchema.safeParse(interviewId).success) {
    return { error: true as const, message: "Invalid interview" };
  }

  const interview = await getInterview(interviewId, userId);
  if (interview == null) return PERMISSION_ERROR;

  if (interview.humeChatId == null) {
    return {
      error: true as const,
      message: "Feedback can't be generated for this interview",
    };
  }

  // Idempotent by default. The only previous guard was a client-side
  // conditional render, and this action is directly POST-able - so a replay
  // re-ran the whole Hume + Gemini pipeline and overwrote existing feedback.
  if (interview.feedback != null) {
    return { error: false as const };
  }

  const decision = await feedbackAj.protect(await request(), {
    userId,
    requested: 1,
  });
  if (decision.isDenied()) {
    return { error: true as const, message: RATE_LIMIT_MESSAGE };
  }

  // The transcript may have been cached during the race between the voice
  // socket closing and Hume flushing its tail. Drop it so feedback is
  // generated from the complete conversation.
  revalidateTag(getHumeChatTag(interview.humeChatId), "default");

  const feedback = await generateAiInterviewFeedback({
    humeChatId: interview.humeChatId,
    jobInfo: interview.jobInfo,
    userName: user.name,
  });

  if (feedback.error) {
    return { error: true as const, message: feedback.message };
  }

  const updated = await updateInterviewDb(interviewId, {
    feedback: feedback.feedback,
    // Persisted so this interview appears on the progress trajectory alongside
    // practice questions and resume analyses.
    rating: feedback.rating,
  });
  if (updated == null) {
    return { error: true as const, message: "Interview not found" };
  }

  return { error: false as const };
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
          // Load-bearing: the tenancy check below compares this to the session
          // user. Dropping it would silently degrade to `undefined !== userId`
          // and make every interview cross-tenant readable and writable.
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
