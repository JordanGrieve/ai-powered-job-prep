import { PricingTable } from "@/app/services/clerk/components/PricingTable";
import { BackLink } from "@/components/BackLink";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canCreateInterview } from "@/app/features/interviews/permissions";

export default async function UpgradePage() {
  // This page must never fail - it is where people go to pay. If the check
  // itself breaks, show the neutral "Plans" heading rather than either an
  // error page or a wrong "you have hit your limit" warning.
  const blocked = await canCreateInterview().then(
    (allowed) => !allowed,
    () => false,
  );

  return (
    <div className="container py-4 max-w-6xl">
      <div className="mb-4">
        <BackLink href="/app">Dashboard</BackLink>
      </div>

      <div className="space-y-16">
        {/* Only warn someone who is actually blocked. This used to render
            unconditionally, so a paying customer who arrived by URL or came
            back after upgrading was told they had hit their limit. */}
        {blocked ? (
          <Alert variant="warning">
            <AlertTriangle className="size-6 text-warning" />
            <AlertTitle>Upgrade Required</AlertTitle>
            <AlertDescription>
              You have reached the limit of your current plan. Please upgrade to
              continue using all features.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl">Plans</h1>
            <p className="text-muted-foreground">
              Compare what each plan includes and change yours at any time.
            </p>
          </div>
        )}

        <PricingTable />
      </div>
    </div>
  );
}
