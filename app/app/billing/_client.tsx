"use client";

import { Button } from "@/components/ui/button";
import { useClerk } from "@clerk/nextjs";

/**
 * Payment methods, invoices and cancellation all live in Clerk's own account
 * portal. Opening it is the correct move rather than rebuilding any of it -
 * and it keeps card details entirely out of this application.
 */
export function ManageSubscription() {
  const { openUserProfile } = useClerk();

  return (
    <div className="space-y-2">
      <h2 className="text-2xl">Manage subscription</h2>
      <p className="text-muted-foreground text-sm">
        Payment method, invoices and cancellation are handled in your account
        settings.
      </p>
      <Button variant="outline" onClick={() => openUserProfile()}>
        Open account settings
      </Button>
    </div>
  );
}
