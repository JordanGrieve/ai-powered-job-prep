import { createEnv } from "@t3-oss/env-nextjs";
import z from "zod";

export const env = createEnv({
  server: {
    // Either set DATABASE_URL directly (hosted Postgres - Neon, Supabase,
    // Vercel Postgres, and what any real deployment will hand you), or set all
    // five DB_* parts and let the transform below compose it. The DB_* group is
    // still what docker-compose.yml interpolates for the local container, so
    // both routes have to work.
    DATABASE_URL: z.string().min(1).optional(),
    DB_PASSWORD: z.string().min(1).optional(),
    DB_HOST: z.string().min(1).optional(),
    DB_USER: z.string().min(1).optional(),
    DB_NAME: z.string().min(1).optional(),
    DB_PORT: z.string().min(1).optional(),
    ARCJET_KEY: z.string().min(1, "ARCJET_KEY is required"),
    // DRY_RUN lets the Playwright suite through - Arcjet detectBot runs in
    // LIVE mode ahead of clerkMiddleware and would 403 headless Chromium on
    // its first request. Never set this to DRY_RUN in production.
    ARCJET_MODE: z.enum(["LIVE", "DRY_RUN"]).default("LIVE"),
    CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
    CLERK_WEBHOOK_SIGNING_SECRET: z
      .string()
      .min(1, "CLERK_WEBHOOK_SIGNING_SECRET is required"),
    HUME_API_KEY: z.string().min(1, "HUME_API_KEY is required"),
    HUME_SECRET_KEY: z.string().min(1, "HUME_SECRET_KEY is required"),
    GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  },
  createFinalSchema: (env) => {
    return z.object(env).transform((val, ctx) => {
      const {
        DATABASE_URL,
        DB_USER,
        DB_PASSWORD,
        DB_HOST,
        DB_PORT,
        DB_NAME,
        ...rest
      } = val;

      // An explicit URL always wins - it is the only thing a hosted provider
      // gives you, and it carries the sslmode/channel_binding params that
      // decomposing into parts would silently drop.
      if (DATABASE_URL) return { ...rest, DATABASE_URL };

      if (!DB_USER || !DB_PASSWORD || !DB_HOST || !DB_PORT || !DB_NAME) {
        ctx.addIssue({
          code: "custom",
          message:
            "Set DATABASE_URL (hosted Postgres), or all five of DB_USER, DB_PASSWORD, DB_HOST, DB_PORT and DB_NAME (local docker-compose).",
        });
        return z.NEVER;
      }

      return {
        ...rest,
        DATABASE_URL: `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
      };
    });
  },
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: process.env,
});
