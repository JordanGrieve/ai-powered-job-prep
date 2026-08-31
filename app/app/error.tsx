"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production the digest is the only handle back to the server-side
    // stack trace, so surface it rather than swallowing it.
    console.error("[app] render error", error.digest, error);
  }, [error]);

  return (
    <div className="h-screen-header flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl md:text-4xl">Something went wrong</h1>
      <p className="text-muted-foreground max-w-prose">
        This one is on us. Try again, and if it keeps happening the reference
        below will help us track it down.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Reference: {error.digest}
        </p>
      )}
      <div className="flex gap-2 mt-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/app">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
