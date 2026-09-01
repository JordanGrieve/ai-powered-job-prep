import { PricingTable } from "@/app/services/clerk/components/PricingTable";
import { getInterviewUsage } from "@/app/features/interviews/permissions";
import { getQuestionUsage } from "@/app/features/questions/permissions";
import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import BackLink from "@/components/BackLink";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Loader2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ManageSubscription } from "./_client";

export const metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <div className="container py-4 max-w-6xl space-y-4">
      <BackLink href="/app">Dashboard</BackLink>
      <Suspense
        fallback={<Loader2 className="animate-spin size-24 mx-auto my-24" />}
      >
        <SuspendedPage />
      </Suspense>
    </div>
  );
}

// Statuses Clerk reports that mean the customer needs to do something.
const NEEDS_ATTENTION = new Set(["past_due", "unpaid", "incomplete"]);
const ENDED = new Set(["canceled", "cancelled", "ended", "incomplete_expired"]);

async function SuspendedPage() {
  const { userId, user, redirectToSignIn } = await getCurrentUser({
    allData: true,
  });
  if (userId == null) return redirectToSignIn();
  if (user == null) return redirect("/onboarding");

  const [interviews, questions] = await Promise.all([
    getInterviewUsage(),
    getQuestionUsage(),
  ]);

  const status = user.subscriptionStatus;
  const needsAttention = status != null && NEEDS_ATTENTION.has(status);
  const ended = status != null && ENDED.has(status);

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-4xl">Billing</h1>
        <p className="text-muted-foreground">
          Your current plan, what you have used, and how to change it.
        </p>
      </div>

      {needsAttention && (
        <Alert variant="warning">
          <AlertTriangle className="size-6 text-warning" />
          <AlertTitle>There is a problem with your payment</AlertTitle>
          <AlertDescription>
            Your subscription is {status}. Update your payment details to keep
            access to paid features.
          </AlertDescription>
        </Alert>
      )}

      {ended && (
        <Alert variant="warning">
          <AlertTriangle className="size-6 text-warning" />
          <AlertTitle>Your subscription has ended</AlertTitle>
          <AlertDescription>
            You are back on the free plan. Pick a plan below to restore paid
            features.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <UsageCard
          title="Mock interviews"
          used={interviews.used}
          limit={interviews.limit}
          isUnlimited={interviews.isUnlimited}
        />
        <UsageCard
          title="Practice questions"
          used={questions.used}
          limit={questions.limit}
          isUnlimited={questions.isUnlimited}
        />
      </div>

      <ManageSubscription />

      <div className="space-y-4">
        <h2 className="text-2xl">Plans</h2>
        <PricingTable />
      </div>
    </div>
  );
}

function UsageCard({
  title,
  used,
  limit,
  isUnlimited,
}: {
  title: string;
  used: number;
  limit: number | null;
  isUnlimited: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isUnlimited ? (
          <p className="text-2xl">Unlimited</p>
        ) : (
          <p className="text-2xl tabular-nums">
            {used}
            <span className="text-muted-foreground text-lg"> / {limit ?? 0}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
