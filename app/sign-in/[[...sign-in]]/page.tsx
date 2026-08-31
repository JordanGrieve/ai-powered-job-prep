import { env } from "@/app/data/env/client";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      {/* Without signUpUrl the "Sign up" link falls through to Clerk's hosted
          portal, which returns to "/" - so the user never visits /onboarding,
          the page that waits for the webhook to create their users row. */}
      <SignIn
        signUpUrl={env.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
        signUpForceRedirectUrl="/onboarding"
        fallbackRedirectUrl="/onboarding"
      />
    </div>
  );
}
