"use server";

import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { getJobInfoIdTag } from "../jobInfos/dbCache";
import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { and, eq } from "drizzle-orm";
import { cacheTag, revalidatePath, revalidateTag } from "next/cache";
import { insertInterview, updateInterview as updateInterviewDb } from "./db";
import { getInterviewIdTag } from "./dbCache";
import { InterviewTable } from "@/app/drizzle/schema/interview";
import { canCreateInterview, PermissionCheckError } from "./permissions";
import { PLAN_LIMIT_MESSAGE, RATE_LIMIT_MESSAGE } from "@/lib/errorToast";
import arcjet, { slidingWindow, tokenBucket, request } from "@arcjet/next";
import { env } from "@/app/data/env/server";
import { generateAiInterviewFeedback } from "@/app/services/ai/interviews";
import { getHumeChatTag } from "@/app/services/hume/lib/cacheTags";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("interviews");

/**
 * Burst protection for createInterview, per user.
 *
 * This was a tokenBucket of capacity 12 refilling 4 a day. That is not a rate
 * limit, it is a quota: four starts a day after a one-off burst of twelve. And
 * it was charged per CLICK, before the Hume connection was attempted, so every
 * failed start - a refused microphone, a wrong config id, Hume being down -
 * spent a token on an interview that never happened. A day spent testing the
 * start flow drained it, and from then on every click answered "Woah! Slow
 * down. Please wait a moment and try again" for the next six hours. Nothing
 * about it was quick, and waiting a moment could not fix it. Observed in
 * production 11 Oct 2026.
 *
 * It also protected the wrong thing. The cost is Hume minutes, and the client
 * talks to Hume directly with an access token the page already handed it -
 * this action only inserts a row. Hume spend is bounded by the plan gate
 * (canCreateInterview) and the 20-minute cap in _StartCall; a daily budget
 * here added to neither. What a limiter on this action CAN do is stop a
 * script flooding the interviews table. Ten starts a minute is more than a
 * person retrying a flaky microphone will reach and still a hard ceiling for
 * anything automated, and one minute is the only window for which the toast's
 * "wait a moment" is actually true.
 */
const aj = arcjet({
  characteristics: ["userId"],
  key: env.ARCJET_KEY,
  rules: [
    slidingWindow({
      interval: "1m",
      max: 10,
      mode: "LIVE",
    }),
  ],
});

/**
 * Feedback generation drains the whole Hume transcript and runs a long-context
 * Gemini call, so it is by far the most expensive path in the app. It gets its
 * own, tighter bucket - the createInterview window above is spent by a
 * different action and gives no protection here. Unlike createInterview this
 * IS a daily budget on purpose: the action is idempotent, so a token is only
 * ever spent when the paid pipeline actually runs.
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

  // A thrown PermissionCheckError means the check itself broke, NOT that the
  // user is out of quota - do not sell them an upgrade for a database blip.
  try {
    if (!(await canCreateInterview())) {
      return { error: true, message: PLAN_LIMIT_MESSAGE };
    }
  } catch (error) {
    if (error instanceof PermissionCheckError) {
      return { error: true, message: error.message };
    }
    throw error;
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

  const decision = await aj.protect(await request(), { userId });
  if (decision.isDenied()) {
    // A full window is a rate limit, not a plan limit. Returning PLAN_LIMIT
    // here sold an upgrade that could not have helped.
    logRateLimited("createInterview", userId, decision);
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
    try {
      if (!(await canCreateInterview())) {
        return { error: true as const, message: PLAN_LIMIT_MESSAGE };
      }
    } catch (error) {
      if (error instanceof PermissionCheckError) {
        return { error: true as const, message: error.message };
      }
      throw error;
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
    logRateLimited("generateInterviewFeedback", userId, decision);
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

  // revalidateTag alone was not enough. It marks the "use cache" entry stale,
  // but the router.refresh() the client fires the moment this action resolves
  // races that invalidation and is served the PRE-write value - so the page
  // re-rendered still showing "Generate Feedback" while 5307 characters of
  // feedback sat in the database. The next navigation was fresh, which is what
  // made it look like the write had silently failed rather than like a cache
  // bug, and is why this got run twice at roughly 2p and 27s a time.
  //
  // revalidatePath also drops the client Router Cache entry for this route, so
  // the refresh cannot be answered from a stale payload.
  revalidatePath(
    `/app/job-infos/${interview.jobInfo.id}/interviews/${interviewId}`,
  );

  return { error: false as const };
}

/**
 * A denial inside a server action used to leave no trace on the server. The
 * proxy logs its own denials, but these surfaced only as a toast in the user's
 * browser - so the first evidence that the old bucket was quota-shaped was a
 * screenshot, and nothing in the Vercel logs could say whether the user had
 * been refused once or forty times, or when the limit would let them back in.
 */
function logRateLimited(
  action: string,
  userId: string,
  decision: Awaited<ReturnType<typeof aj.protect>>,
) {
  const reason = decision.reason;
  log.warn("rate limited", {
    action,
    userId,
    ...(reason.isRateLimit()
      ? {
          max: reason.max,
          remaining: reason.remaining,
          resetTime: reason.resetTime?.toISOString(),
        }
      : { reason: reason.type }),
  });
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
