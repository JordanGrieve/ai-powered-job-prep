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

    // Create the row ourselves before falling back to waiting for the webhook.
    // This is what makes signup work with no inbound callback at all - locally,
    // or in a deployment where the webhook endpoint or signing secret is not
    // configured. Both paths upsert on the Clerk id, so a webhook arriving
    // mid-flight is a no-op rather than a conflict.
    async function provisionThenPoll() {
      if (cancelled) return;

      try {
        if (await provisionCurrentUserAction()) {
          if (!cancelled) router.replace("/app");
          return;
        }
      } catch (error) {
        console.error("[onboarding] provisioning failed", error);
      }

      // Provisioning did not succeed (Clerk unreachable, or the database is
      // down). The webhook may still land, so keep polling.
      if (!cancelled) void poll();
    }

    async function poll() {
      if (cancelled) return;
      attempts++;

      try {
        if (await isCurrentUserProvisioned()) {
          if (!cancelled) router.replace("/app");
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

    void provisionThenPoll();

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
