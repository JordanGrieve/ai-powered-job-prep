import { PricingTable } from "@/app/services/clerk/components/PricingTable";
import { BackLink } from "@/components/BackLink";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canCreateInterview } from "@/app/features/interviews/permissions";
import { Suspense } from "react";

export default function UpgradePage() {
  return (
    <div className="container py-4 max-w-6xl">
      <div className="mb-4">
        <BackLink href="/app">Dashboard</BackLink>
      </div>

      <div className="space-y-16">
        {/* The entitlement check reads auth(), which is request-time data.
            Suspending it lets the pricing table - the thing people came for -
            prerender instead of waiting on a check that only decides which
            heading to show. The fallback is the neutral heading, so nobody
            ever sees a limit warning appear and then vanish. */}
        <Suspense fallback={<PlansHeading />}>
          <UpgradeNotice />
        </Suspense>

        <PricingTable />
      </div>
    </div>
  );
}

async function UpgradeNotice() {
  // This page must never fail - it is where people go to pay. If the check
  // itself breaks, fall back to the neutral heading rather than an error page
  // or a wrong "you have hit your limit" warning.
  const blocked = await canCreateInterview().then(
    (allowed) => !allowed,
    () => false,
  );

  // Only warn someone who is actually blocked. This used to render
  // unconditionally, so a paying customer who arrived by URL or came back
  // after upgrading was told they had hit their limit.
  if (!blocked) return <PlansHeading />;

  return (
    <Alert variant="warning">
      <AlertTriangle className="size-6 text-warning" />
      <AlertTitle>Upgrade Required</AlertTitle>
      <AlertDescription>
        You have reached the limit of your current plan. Please upgrade to
        continue using all features.
      </AlertDescription>
    </Alert>
  );
}

function PlansHeading() {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl md:text-4xl">Plans</h1>
      <p className="text-muted-foreground">
        Compare what each plan includes and change yours at any time.
      </p>
    </div>
  );
}
