import { env } from "@/app/data/env/client";
import { SignIn } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      {/* Clerk's <SignIn> is a ROUTED component - it reads the pathname to
          decide which step to render (/sign-in, /sign-in/factor-one, ...), so
          under cacheComponents it must stream rather than prerender. The
          centring shell still prerenders, which is all there is to prerender
          on this page.

          Without signUpUrl the "Sign up" link falls through to Clerk's hosted
          portal, which returns to "/" - so the user never visits /onboarding,
          the page that waits for the webhook to create their users row. */}
      <Suspense
        fallback={<Loader2Icon className="animate-spin size-12 text-muted-foreground" />}
      >
        <SignIn
          signUpUrl={env.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
          signUpForceRedirectUrl="/onboarding"
          fallbackRedirectUrl="/onboarding"
        />
      </Suspense>
    </div>
  );
}
