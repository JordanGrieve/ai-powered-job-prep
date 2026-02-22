import { env } from "@/app/data/env/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY,
});
