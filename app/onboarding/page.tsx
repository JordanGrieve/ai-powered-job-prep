import { redirect } from "next/navigation";
import { getCurrentUser } from "../services/clerk/lib/getCurrentUser";
import { OnBoardingClient } from "./_client";
import { MAIN_CONTENT_ID } from "@/components/SkipToContent";
import type { Metadata } from "next";

// The root layout applies a "%s · Land" template. Without this every
// signed-in page shared one generic title, which is WCAG 2.4.2 and makes
// browser tabs and history entries indistinguishable.
export const metadata: Metadata = { title: "Creating your account" };

/**
 * Deliberately opts out of instant prerendering rather than suspending.
 *
 * This page exists ONLY to make a request-time auth decision and redirect -
 * to "/" if signed out, to /app once the users row exists. There is no
 * meaningful shell to prerender, and suspending the check would flash
 * "Creating your account" at someone who is about to be sent straight to /app.
 * Blocking is the correct behaviour here, not a workaround.
 */
export const instant = false;

export default async function OnboardingPage() {
  const { userId, user } = await getCurrentUser({
    allData: true,
  });

  if (userId == null) return redirect("/");
  if (user != null) return redirect("/app");

  // Signed in with no users row. The client provisions it from the session via
  // a server action - see provisionCurrentUser for why account creation must
  // not depend on the webhook, and provisionCurrentUserAction for why the write
  // cannot happen in this render.
  return (
    <main id={MAIN_CONTENT_ID} className="container flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-4xl">Creating your account</h1>
      <OnBoardingClient />
    </main>
  );
}
