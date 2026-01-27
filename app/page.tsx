import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export default function HomePage() {
  return (
    <div>
      <UserButton />
      <SignInButton forceRedirectUrl="/onboarding" />
    </div>
  );
}
