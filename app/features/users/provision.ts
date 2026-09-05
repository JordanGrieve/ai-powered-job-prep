import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { createLogger } from "@/lib/logger";
import { upsertUser } from "./db";
import { resolveName } from "./resolveName";

const log = createLogger("provision");

/**
 * Creates this caller's users row directly from Clerk, without waiting for the
 * webhook.
 *
 * Provisioning used to depend on the `user.created` webhook ALONE. That made
 * account creation - the one flow that must never fail - hinge on an external
 * callback reaching this deployment: an unset CLERK_WEBHOOK_SIGNING_SECRET, a
 * missing endpoint, a Clerk outage or a retry still in flight all produced the
 * same result, a signed-in user stuck forever on "Creating your account" with
 * no way through. Locally, where Clerk cannot reach localhost at all, it could
 * never succeed.
 *
 * The webhook is still the fast path and remains the only handler for
 * user.updated and user.deleted. This is the guarantee underneath it: by the
 * time someone reaches /onboarding they are already authenticated, so their
 * identity is known from the session and the row can simply be written.
 *
 * Both paths go through the same upsertUser, keyed on the Clerk id, so a
 * webhook arriving mid-flight is a harmless no-op rather than a duplicate.
 *
 * Returns false (rather than throwing) when provisioning could not complete,
 * so the caller can fall back to polling instead of showing an error page.
 */
export async function provisionCurrentUser(): Promise<boolean> {
  let user: Awaited<ReturnType<typeof currentUser>>;

  try {
    user = await currentUser();
  } catch (error) {
    log.error("could not load the signed-in user from Clerk", error);
    return false;
  }

  if (user == null) return false;

  // primaryEmailAddressId is what the webhook keys on; fall back to the first
  // address so an account whose primary is somehow unset still provisions.
  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

  if (!email) {
    log.error("signed-in user has no email address", undefined, {
      userId: user.id,
    });
    return false;
  }

  try {
    await upsertUser({
      id: user.id,
      email,
      name: resolveName({
        first_name: user.firstName,
        last_name: user.lastName,
        username: user.username,
        email,
      }),
      imageUrl: user.imageUrl,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(),
    });
  } catch (error) {
    log.error("could not write the users row", error, { userId: user.id });
    return false;
  }

  log.info("user provisioned from session", { userId: user.id });
  return true;
}
