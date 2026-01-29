import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
    <div className="p-4 space-y-4">
      <UserButton />
      <SignInButton forceRedirectUrl="/onboarding" />
      <ThemeToggle />
    </div>
  );
}
