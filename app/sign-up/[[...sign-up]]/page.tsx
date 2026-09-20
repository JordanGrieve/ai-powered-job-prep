import { SignUp } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";
import { Suspense } from "react";
import { MAIN_CONTENT_ID } from "@/components/SkipToContent";
import type { Metadata } from "next";

// The root layout applies a "%s · Land" template. Without this every
// signed-in page shared one generic title, which is WCAG 2.4.2 and makes
// browser tabs and history entries indistinguishable.
export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <main id={MAIN_CONTENT_ID} className="flex h-screen w-full items-center justify-center">
      {/* Routed component - see the note on the sign-in page. /onboarding
          polls until the Clerk webhook writes the users row, then forwards to
          /app; sending new accounts anywhere else skips it. */}
      <Suspense
        fallback={<Loader2Icon className="animate-spin size-12 text-muted-foreground" />}
      >
        <SignUp forceRedirectUrl="/onboarding" />
      </Suspense>
    </main>
  );
}
