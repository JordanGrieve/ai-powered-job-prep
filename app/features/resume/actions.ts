"use server";

import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { db } from "@/app/drizzle/db";
import { jobInfoTable } from "@/app/drizzle/schema/jobInfo";
import { and, eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { getJobInfoIdTag } from "../jobInfos/dbCache";
import { canRunResumeAnalysis } from "./permissions";
import { PLAN_LIMIT_MESSAGE, RATE_LIMIT_MESSAGE } from "@/lib/errorToast";
import {
  ACCEPTED_RESUME_TYPES,
  MAX_RESUME_BYTES,
  generateAiResumeAnalysis,
} from "@/app/services/ai/resume";
import arcjet, { request, tokenBucket } from "@arcjet/next";
import { env } from "@/app/data/env/server";
import { z } from "zod";

// Resume analysis sends a whole document to Gemini, so it is expensive per
// call and gets a tight budget of its own.
const aj = arcjet({
  characteristics: ["userId"],
  key: env.ARCJET_KEY,
  rules: [
    tokenBucket({ capacity: 10, refillRate: 5, interval: "1d", mode: "LIVE" }),
  ],
});

const uuidSchema = z.string().uuid();

export async function analyzeResume(
  formData: FormData,
): Promise<{ error: true; message: string } | { error: false; text: string }> {
  const { userId } = await getCurrentUser();
  if (userId == null) {
    return { error: true, message: "You don't have permission to do this" };
  }

  const jobInfoId = formData.get("jobInfoId");
  const parsedId = uuidSchema.safeParse(jobInfoId);
  if (!parsedId.success) {
    return { error: true, message: "Invalid job info" };
  }

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    return { error: true, message: "Choose a file to upload." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { error: true, message: "That file is larger than 5MB." };
  }
  if (
    !ACCEPTED_RESUME_TYPES.includes(
      file.type as (typeof ACCEPTED_RESUME_TYPES)[number],
    )
  ) {
    return {
      error: true,
      message:
        "Upload a PDF, .txt or .md file. Gemini cannot read .docx directly — export to PDF first.",
    };
  }

  // Entitlement before ownership before rate limit: the cheapest rejections
  // first, and probing an id you don't own never spends your own tokens.
  if (!(await canRunResumeAnalysis())) {
    return { error: true, message: PLAN_LIMIT_MESSAGE };
  }

  const jobInfo = await getJobInfo(parsedId.data, userId);
  if (jobInfo == null) {
    return { error: true, message: "You don't have permission to do this" };
  }

  const decision = await aj.protect(await request(), { userId, requested: 1 });
  if (decision.isDenied()) {
    return { error: true, message: RATE_LIMIT_MESSAGE };
  }

  const data = new Uint8Array(await file.arrayBuffer());

  const result = await generateAiResumeAnalysis({
    jobInfo,
    file: { data, mediaType: file.type },
  });

  if (result.error) return { error: true, message: result.message };
  return { error: false, text: result.text };
}

async function getJobInfo(id: string, userId: string) {
  "use cache";
  cacheTag(getJobInfoIdTag(id));

  return db.query.jobInfoTable.findFirst({
    where: and(eq(jobInfoTable.id, id), eq(jobInfoTable.userId, userId)),
  });
}
