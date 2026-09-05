import { redirect } from "next/navigation";
import { getCurrentUser } from "../services/clerk/lib/getCurrentUser";
import { OnBoardingClient } from "./_client";

/**
 * Deliberately opts out of instant prerendering rather than suspending.
 *
 * This page exists ONLY to make a request-time auth decision and redirect -
 * to "/" if signed out, to /app once the Clerk webhook has written the users
 * row. There is no meaningful shell to prerender, and suspending the check
 * would flash "Creating your account" at someone who is about to be sent
 * straight to /app. Blocking is the correct behaviour here, not a workaround.
 */
export const instant = false;

export default async function OnboardingPage() {
  const { userId, user } = await getCurrentUser({
    allData: true,
  });

  if (userId == null) return redirect("/");
  if (user != null) return redirect("/app");

  return (
    <div className="container flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-4xl">Creating your account</h1>
      <OnBoardingClient />
    </div>
  );
}
