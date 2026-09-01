"use server";

import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { QuestionTable } from "@/app/drizzle/schema/question";
import { questionDifficulties } from "@/app/drizzle/schema/question";
import { and, asc, eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { getJobInfoIdTag } from "../jobInfos/dbCache";
import { getQuestionJobInfoTag } from "./dbCache";
import { insertQuestion, updateQuestion } from "./db";
import { canCreateQuestion } from "./permissions";
import { PLAN_LIMIT_MESSAGE, RATE_LIMIT_MESSAGE } from "@/lib/errorToast";
import {
  generateAiQuestion,
  generateRatedAnswerFeedback,
} from "@/app/services/ai/questions";
import arcjet, { request, tokenBucket } from "@arcjet/next";
import { env } from "@/app/data/env/server";
import { z } from "zod";

// Question generation and answer review are both Gemini calls, so they need
// their own budget rather than sharing the interview bucket.
const aj = arcjet({
  characteristics: ["userId"],
  key: env.ARCJET_KEY,
  rules: [
    tokenBucket({ capacity: 30, refillRate: 15, interval: "1d", mode: "LIVE" }),
  ],
});

const uuidSchema = z.string().uuid();
const difficultySchema = z.enum(questionDifficulties);
const answerSchema = z.string().trim().min(1).max(10_000);

const PERMISSION_ERROR = {
  error: true as const,
  message: "You don't have permission to do this",
};

export async function createQuestion({
  jobInfoId,
  difficulty,
}: {
  jobInfoId: string;
  difficulty: string;
}): Promise<
  { error: true; message: string } | { error: false; id: string; text: string }
> {
  const { userId } = await getCurrentUser();
  if (userId == null) return PERMISSION_ERROR;

  const parsedId = uuidSchema.safeParse(jobInfoId);
  const parsedDifficulty = difficultySchema.safeParse(difficulty);
  if (!parsedId.success || !parsedDifficulty.success) {
    return { error: true, message: "Invalid request" };
  }

  if (!(await canCreateQuestion())) {
    return { error: true, message: PLAN_LIMIT_MESSAGE };
  }

  // Ownership before rate limiting, so probing cannot burn the caller's tokens.
  const jobInfo = await getJobInfo(parsedId.data, userId);
  if (jobInfo == null) return PERMISSION_ERROR;

  const decision = await aj.protect(await request(), { userId, requested: 1 });
  if (decision.isDenied()) {
    return { error: true, message: RATE_LIMIT_MESSAGE };
  }

  const previous = await getQuestions(parsedId.data);

  const generated = await generateAiQuestion({
    jobInfo,
    difficulty: parsedDifficulty.data,
    previousQuestions: previous.map((q) => q.text),
  });
  if (generated.error) return { error: true, message: generated.message };

  const question = await insertQuestion({
    jobId: parsedId.data,
    text: generated.text,
    difficulty: parsedDifficulty.data,
  });

  return { error: false, id: question.id, text: generated.text };
}

export async function reviewAnswer({
  questionId,
  answer,
}: {
  questionId: string;
  answer: string;
}): Promise<
  | { error: true; message: string }
  | { error: false; feedback: string; rating: number }
> {
  const { userId } = await getCurrentUser();
  if (userId == null) return PERMISSION_ERROR;

  const parsedId = uuidSchema.safeParse(questionId);
  const parsedAnswer = answerSchema.safeParse(answer);
  if (!parsedId.success) return { error: true, message: "Invalid question" };
  if (!parsedAnswer.success) {
    return { error: true, message: "Write an answer first." };
  }

  const question = await getOwnedQuestion(parsedId.data, userId);
  if (question == null) return PERMISSION_ERROR;

  const decision = await aj.protect(await request(), { userId, requested: 1 });
  if (decision.isDenied()) {
    return { error: true, message: RATE_LIMIT_MESSAGE };
  }

  const generated = await generateRatedAnswerFeedback({
    jobInfo: question.jobInfo,
    question: question.text,
    answer: parsedAnswer.data,
  });
  if (generated.error) return { error: true, message: generated.message };

  // Persist the attempt. Previously the answer and its feedback were shown
  // once and thrown away, so there was no practice history and nothing to
  // chart. answeredAt is what the progress query orders on.
  const saved = await updateQuestion(parsedId.data, {
    answer: parsedAnswer.data,
    feedback: generated.feedback,
    rating: generated.rating,
    answeredAt: new Date(),
  });
  if (saved == null) {
    return { error: true, message: "Question not found" };
  }

  return { error: false, feedback: generated.feedback, rating: generated.rating };
}

async function getJobInfo(id: string, userId: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));

  return db.query.jobInfoTable.findFirst({
    where: and(eq(jobInfoTable.id, id), eq(jobInfoTable.userId, userId)),
  });
}

export async function getQuestions(jobInfoId: string) {
  "use cache";
  cacheTag(getQuestionJobInfoTag(jobInfoId));

  return db.query.QuestionTable.findMany({
    where: eq(QuestionTable.jobId, jobInfoId),
    orderBy: asc(QuestionTable.createdAt),
  });
}

async function getOwnedQuestion(id: string, userId: string) {
  const question = await db.query.QuestionTable.findFirst({
    where: eq(QuestionTable.id, id),
    with: {
      jobInfo: {
        columns: {
          // Load-bearing for the tenancy check below - see the same note in
          // the interviews actions.
          userId: true,
          title: true,
          description: true,
          experienceLevel: true,
        },
      },
    },
  });

  if (question == null) return null;
  if (question.jobInfo.userId !== userId) return null;
  return question;
}
