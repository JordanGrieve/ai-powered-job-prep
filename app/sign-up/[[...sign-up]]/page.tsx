import { SignUp } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      {/* Routed component - see the note on the sign-in page. /onboarding
          polls until the Clerk webhook writes the users row, then forwards to
          /app; sending new accounts anywhere else skips it. */}
      <Suspense
        fallback={<Loader2Icon className="animate-spin size-12 text-muted-foreground" />}
      >
        <SignUp forceRedirectUrl="/onboarding" />
      </Suspense>
    </div>
  );
}
