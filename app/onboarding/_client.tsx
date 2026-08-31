"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isCurrentUserProvisioned } from "../features/users/actions";

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
