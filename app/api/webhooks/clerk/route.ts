import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import {
  upsertUser,
  deleteUser,
  recordSubscriptionStatus,
} from "@/app/features/users/db";
import { env } from "@/app/data/env/server";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { createLogger } from "@/lib/logger";
// Shared with onboarding's direct provisioning so whichever path creates the
// row first, the resolved name is identical.
import { resolveName } from "@/app/features/users/resolveName";

const log = createLogger("clerk-webhook");

export async function POST(request: NextRequest) {
  let event: WebhookEvent;

  // Signature failures are a client/config problem and must not be retried.
  // Keeping them in their own try block stops a Postgres outage below from
  // being reported as "Invalid webhook" with a non-retryable 400.
  try {
    event = await verifyWebhook(request, {
      signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch (error) {
    log.error("signature verification failed", error);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const clerkData = event.data;
        const email = clerkData.email_addresses.find(
          (e) => e.id === clerkData.primary_email_address_id,
        )?.email_address;

        if (!email) {
          log.error("no primary email on payload", undefined, {
            eventType: event.type,
            userId: clerkData.id,
          });
          return NextResponse.json(
            { error: "Email not found" },
            { status: 400 },
          );
        }

        await upsertUser({
          id: clerkData.id,
          email,
          name: resolveName({ ...clerkData, email }),
          imageUrl: clerkData.image_url,
          createdAt: new Date(clerkData.created_at),
          updatedAt: new Date(clerkData.updated_at),
        });

        log.info("user upserted", { eventType: event.type, userId: clerkData.id });
        break;
      }
      case "user.deleted": {
        if (!event.data.id) {
          log.error("user.deleted with no id");
          return NextResponse.json(
            { error: "User ID not found" },
            { status: 400 },
          );
        }
        await deleteUser(event.data.id);
        log.info("user deleted", { userId: event.data.id });
        break;
      }
      default: {
        // Clerk Billing lifecycle. Entitlements are read live via auth().has(),
        // so nothing here grants or revokes access - this only records the
        // change so past_due and cancellation can be messaged in the UI, and
        // so a payment failure is visible in the logs at all.
        if (
          event.type.startsWith("subscription") ||
          event.type.startsWith("paymentAttempt")
        ) {
          const data = event.data as { id?: string; status?: string } & {
            payer?: { user_id?: string };
            user_id?: string;
          };
          const userId = data.payer?.user_id ?? data.user_id;

          log.info("billing event", {
            eventType: event.type,
            userId,
            status: data.status,
          });

          if (userId) {
            await recordSubscriptionStatus(
              userId,
              data.status ?? event.type,
              new Date(),
            );
          }
          break;
        }

        log.info("ignoring event type", { eventType: event.type });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    // A database failure IS retryable - return 500 so Clerk backs off and
    // redelivers instead of dropping the event on a 400.
    log.error("handler failed", error, { eventType: event.type });
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}
