"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isCurrentUserProvisioned,
  provisionCurrentUserAction,
} from "../features/users/actions";

// The old 250ms poll issued ~240 requests/minute against the 50/min Arcjet
// sliding window in proxy.ts, so it exhausted the caller's own budget and then
// 403'd them on every route. Back off instead, and give up rather than
// hammering forever.
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 8000;
const MAX_ATTEMPTS = 12;

export function OnBoardingClient() {
  const router = useRouter();
  const [givenUp, setGivenUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let attempts = 0;
    let delay = INITIAL_DELAY_MS;

    // Whichever of the two routes gets there first wins; the other is a no-op.
    let redirected = false;
    function succeed() {
      if (cancelled || redirected) return;
      redirected = true;
      router.replace("/app");
    }

    // Create the row ourselves rather than waiting for the webhook. This is
    // what makes signup work with no inbound callback at all - locally, or in
    // a deployment where the webhook endpoint or signing secret is not
    // configured. Both paths upsert on the Clerk id, so a webhook arriving
    // mid-flight is a no-op rather than a conflict.
    async function provision() {
      if (cancelled) return;

      try {
        if (await provisionCurrentUserAction()) succeed();
      } catch (error) {
        console.error("[onboarding] provisioning failed", error);
      }
    }

    async function poll() {
      if (cancelled) return;
      attempts++;

      try {
        if (await isCurrentUserProvisioned()) {
          succeed();
          return;
        }
      } catch (error) {
        console.error("[onboarding] provisioning check failed", error);
      }

      if (cancelled) return;

      if (attempts >= MAX_ATTEMPTS) {
        setGivenUp(true);
        return;
      }

      delay = Math.min(delay * 1.5, MAX_DELAY_MS);
      timeoutId = setTimeout(poll, delay);
    }

    // Deliberately NOT sequential. Chaining the poll behind provisioning meant
    // a provisioning call that never settles also stopped the poll from ever
    // starting - so a hung query left the user on this screen forever, which is
    // the exact failure provisioning exists to prevent. The pg pool bounds
    // connection ACQUISITION (connectionTimeoutMillis) but not query duration,
    // and currentUser() is a network call to Clerk, so neither await is
    // guaranteed to settle. Racing them means either route alone is enough.
    void provision();
    timeoutId = setTimeout(poll, INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [router]);

  if (givenUp) {
    return (
      <p className="text-muted-foreground max-w-prose text-center">
        This is taking longer than expected. Your account is created, but our
        records haven&apos;t caught up yet. Try refreshing in a moment — if it
        still doesn&apos;t work, the Clerk webhook may not be reaching this
        deployment.
      </p>
    );
  }

  return <Loader2Icon className="size-24 animate-spin" />;
}
