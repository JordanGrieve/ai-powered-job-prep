import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ClerkProvider,
  SignInButton,
  SignUp,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { PricingTable } from "./services/clerk/components/PricingTable";

export default function HomePage() {
  return (
    <div className="p-4 space-y-4">
      <UserButton />
      <SignInButton forceRedirectUrl="/onboarding" />
      <ThemeToggle />
      <PricingTable />
    </div>
  );
}
