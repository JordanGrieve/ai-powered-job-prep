import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      {/* /onboarding polls until the Clerk webhook writes the users row, then
          forwards to /app. Sending new accounts anywhere else skips it. */}
      <SignUp forceRedirectUrl="/onboarding" />
    </div>
  );
}
