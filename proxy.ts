import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/next";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { env } from "./app/data/env/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
]);

/**
 * Webhooks are machine-to-machine and authenticate themselves via their own
 * signature check, so they must bypass Arcjet entirely. detectBot runs in LIVE
 * mode and allows only SEARCH_ENGINE/MONITOR/PREVIEW - Svix's delivery client
 * matches none of those, so every Clerk event was being answered with a bare
 * 403. Since that webhook is the only writer of the users table, a denial
 * silently dropped user.created/updated/deleted forever and left new sign-ups
 * hanging on the onboarding screen with nothing in the logs to explain it.
 *
 * Listing the path in isPublicRoute was not enough: that only skips
 * auth.protect(), while the Arcjet decision runs first.
 */
const isWebhookRoute = createRouteMatcher(["/api/webhooks/(.*)"]);

const mode = env.ARCJET_MODE;

const aj = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    shield({
      mode, // LIVE blocks requests; DRY_RUN logs only (used by the e2e suite)
    }),
    detectBot({
      mode,
      allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:MONITOR", "CATEGORY:PREVIEW"],
    }),
    slidingWindow({
      mode,
      interval: "1m",
      max: 50,
    }),
  ],
});

export default clerkMiddleware(async (auth, req) => {
  if (!isWebhookRoute(req)) {
    const decision = await aj.protect(req);

    // Failing open is the right call for an Arcjet outage, but it must be
    // visible - silently degrading the only shield in front of the app is how
    // you find out weeks later.
    if (decision.isErrored()) {
      console.error(
        `[arcjet] decision errored for ${req.nextUrl.pathname}`,
        decision.reason,
      );
    } else if (decision.isDenied()) {
      console.warn(
        `[arcjet] denied ${req.method} ${req.nextUrl.pathname}`,
        decision.reason,
      );

      // A rate-limited client is not a forbidden client. 429 lets well-behaved
      // callers back off instead of treating the block as permanent.
      if (decision.reason.isRateLimit()) {
        return new Response("Too many requests", {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }

      return new Response("Forbidden", { status: 403 });
    }
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
