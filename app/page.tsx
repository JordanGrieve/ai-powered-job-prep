import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { BrainCircuit, FileSlidersIcon, MicIcon, SpeechIcon } from "lucide-react";
import Link from "next/link";
import { PricingTable } from "./services/clerk/components/PricingTable";

const steps = [
  {
    Icon: FileSlidersIcon,
    title: "Paste the job description",
    body: "Drop in the role you're actually applying for — title, description and seniority. Everything after this is tailored to it.",
  },
  {
    Icon: MicIcon,
    title: "Talk to an AI interviewer",
    body: "A real voice conversation, not a form. It asks follow-ups based on your answers and the role you gave it.",
  },
  {
    Icon: SpeechIcon,
    title: "Get scored, specific feedback",
    body: "Clarity, confidence, pacing, role fit and more — each rated out of 10, with quotes from your own answers.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="h-header flex items-center justify-between px-4 border-b">
        <div className="flex items-center gap-2">
          <BrainCircuit className="size-6 text-primary" />
          <span className="text-lg font-semibold">Land</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignedOut>
            {/* SignInButton wraps a single child - it does NOT go inside
                <Button asChild>. Inverting these throws "You've passed
                multiple children components to <SignInButton/>" at render.
                /onboarding waits for the Clerk webhook to create the users
                row before forwarding to /app. */}
            <SignInButton forceRedirectUrl="/onboarding">
              <Button>Sign in</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Button asChild>
              <Link href="/app">Go to dashboard</Link>
            </Button>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 md:py-28 text-center max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-balance">
            Practise the interview before it counts
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-balance">
            Land runs a live voice mock interview against the exact job
            you&apos;re chasing, then tells you — specifically — what to fix.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <SignedOut>
              <SignInButton forceRedirectUrl="/onboarding">
                <Button size="lg">Start practising free</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button size="lg" asChild>
                <Link href="/app">Go to your dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-16 md:py-20">
            <h2 className="text-2xl md:text-3xl text-center mb-12">
              How it works
            </h2>
            <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
              {steps.map(({ Icon, title, body }, index) => (
                <div key={title} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Icon className="size-6 text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground tabular-nums">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="container mx-auto px-4 py-16 md:py-20">
            <h2 className="text-2xl md:text-3xl text-center mb-4">
              Pricing
            </h2>
            <p className="text-muted-foreground text-center mb-12">
              Start with a free interview. Upgrade when you want more.
            </p>
            <PricingTable />
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BrainCircuit className="size-4" />
            <span>Land — AI Powered Job Prep</span>
          </div>
          <SignedOut>
            <SignInButton forceRedirectUrl="/onboarding">
              <button className="hover:text-foreground transition-colors">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/app" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </SignedIn>
        </div>
      </footer>
    </div>
  );
}
