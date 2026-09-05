import {
  generateObject,
  NoObjectGeneratedError,
  type ModelMessage,
} from "ai";
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
    const base = { ...context, boundary, model: env.GEMINI_MODEL };
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof Error && error.name === "TimeoutError") {
      log.error("generation timed out", error, { ...base, timeoutMs });
      return { error: true, message: "That took too long. Please try again." };
    }

    // generateObject throws NoObjectGeneratedError when the response is not
    // parseable, and BY FAR the most common cause is hitting maxOutputTokens
    // mid-JSON. The SDK's own message ("No object generated: could not parse
    // the response") points at parsing and hides the real cause, which cost
    // real debugging time - so name it explicitly in the log.
    if (NoObjectGeneratedError.isInstance(error)) {
      log.error("no object generated - likely truncated output", error, {
        ...base,
        maxOutputTokens,
        finishReason: error.finishReason,
        usage: error.usage,
        textLength: error.text?.length,
      });
      return {
        error: true,
        message:
          error.finishReason === "length"
            ? "The response was cut short. Please try again."
            : "The response came back malformed. Please try again.",
      };
    }
    if (/quota|rate.?limit|429|high demand|overloaded/i.test(message)) {
      log.error("provider unavailable", error, base);
      return {
        error: true,
        message: "The AI service is busy right now. Please try again shortly.",
      };
    }

    log.error("generation failed", error, base);
    return { error: true, message: "Something went wrong. Please try again." };
  }
}
