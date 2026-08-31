import { createLogger } from "@/lib/logger";

const log = createLogger("request");

export async function register() {
  // Deliberately left as an integration seam rather than committing to a
  // vendor. To wire Sentry:
  //   1. npm i @sentry/nextjs
  //   2. add SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN to app/data/env/*
  //   3. here: if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config")
  //   4. add instrumentation-client.ts and withSentryConfig in next.config.ts
  // See the Observability task in Asana for why the vendor choice is open.
}

/**
 * Next calls this for every uncaught server-side error, including ones thrown
 * inside "use cache" functions - which is where the Hume fetch lives, and
 * where failures were previously completely invisible.
 */
export const onRequestError: import("next").Instrumentation.onRequestError =
  async (error, request, context) => {
    log.error("uncaught server error", error, {
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    });
  };
