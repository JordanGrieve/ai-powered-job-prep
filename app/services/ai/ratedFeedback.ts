import { generateObject, type ModelMessage } from "ai";
import { z } from "zod";
import { google } from "./models/google";
import { env } from "@/app/data/env/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("gemini");

/**
 * Shared shape for every piece of AI feedback in the app.
 *
 * The rating is the reason this exists. Feedback used to come back as freeform
 * markdown, which reads well but cannot be charted - and "your clarity went
 * 6 -> 8 over four attempts" is the entire retention argument for a practice
 * product. Asking the model for a structured object is far more reliable than
 * regexing "N/10" out of prose, which breaks the first time the model decides
 * to phrase a heading differently.
 */
export const ratedFeedbackSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe("Overall performance, 1-10. Be honest; do not inflate."),
  feedback: z
    .string()
    .min(1)
    .describe("The full written feedback, in markdown."),
});

export type RatedFeedback = z.infer<typeof ratedFeedbackSchema>;

export type AiResult<T> = { error: true; message: string } | ({ error: false } & T);

/**
 * Callers always build a single user message. Passing ModelMessage[] rather
 * than a string keeps one code path for both the text-only generators and the
 * resume one, which needs a file part alongside its text.
 */
export async function generateRatedFeedback({
  system,
  messages,
  maxOutputTokens,
  timeoutMs,
  boundary,
  context = {},
}: {
  system: string;
  messages: ModelMessage[];
  maxOutputTokens: number;
  timeoutMs: number;
  boundary: string;
  context?: Record<string, unknown>;
}): Promise<AiResult<RatedFeedback>> {
  try {
    const { object, usage, finishReason } = await generateObject({
      model: google(env.GEMINI_MODEL),
      schema: ratedFeedbackSchema,
      system,
      messages,
      maxOutputTokens,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });

    // Token usage is logged on every call so that when pricing comes up there
    // is real per-generation cost data rather than a guess.
    log.info("generation complete", {
      ...context,
      boundary,
      model: env.GEMINI_MODEL,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      finishReason,
    });

    const parsed = ratedFeedbackSchema.safeParse(object);
    if (!parsed.success || parsed.data.feedback.trim().length === 0) {
      log.error("unusable generation", undefined, {
        ...context,
        boundary,
        model: env.GEMINI_MODEL,
        finishReason,
      });
      return {
        error: true,
        message: "The response came back incomplete. Please try again.",
      };
    }

    return { error: false, ...parsed.data };
  } catch (error) {
    log.error("generation failed", error, {
      ...context,
      boundary,
      model: env.GEMINI_MODEL,
    });

    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return { error: true, message: "That took too long. Please try again." };
    }
    if (/quota|rate.?limit|429/i.test(message)) {
      return {
        error: true,
        message: "The AI service is busy right now. Please try again shortly.",
      };
    }
    return { error: true, message: "Something went wrong. Please try again." };
  }
}
