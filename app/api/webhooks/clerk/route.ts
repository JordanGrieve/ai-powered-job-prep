import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { upsertUser, deleteUser } from "@/app/features/users/db";
import { env } from "@/app/data/env/server";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("clerk-webhook");

/**
 * Clerk types first_name/last_name as `string | null`, so the previous
 * `${first_name} ${last_name}` template persisted the literal "null null"
 * into a notNull column for name-less accounts. That string then rendered as
 * the avatar initials and was sent to Gemini as the interviewee's name.
 */
function resolveName(data: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email: string;
}) {
  const full = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (data.username) return data.username;
  return data.email.split("@")[0];
}

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
      default:
        log.info("ignoring event type", { eventType: event.type });
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
