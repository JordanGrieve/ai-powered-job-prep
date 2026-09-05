"use server";

import { getCurrentUser } from "@/app/services/clerk/lib/getCurrentUser";
import { provisionCurrentUser } from "./provision";

/**
 * Creates the caller's users row from their Clerk session.
 *
 * Lives in an action rather than in /onboarding's render because provisioning
 * writes to the database and then revalidates the user cache tag - and Next
 * rejects revalidateTag during render ("must always happen outside of renders
 * and cached functions"). Calling it from the page wrote the row and THEN
 * threw, which looked like a provisioning failure in the logs while actually
 * having succeeded.
 *
 * Takes no arguments: the identity comes from the session, never the caller.
 */
export async function provisionCurrentUserAction(): Promise<boolean> {
  return provisionCurrentUser();
}

/**
 * Reports whether the Clerk webhook has written this caller's users row yet.
 *
 * This deliberately takes no arguments. The previous version was a `"use cache"`
 * module exporting getUser(id), imported directly by a client component - which
 * meant (a) no server-action RPC boundary was created, so `pg` and the server
 * env module were pulled into the browser bundle, and (b) the id came from the
 * caller and was never checked against the session, letting any signed-in user
 * read another user's email, name and imageUrl by id.
 *
 * The cached, id-keyed row read stays private inside getCurrentUser. It cannot
 * live here: auth() cannot be called from within a `"use cache"` scope.
 */
export async function isCurrentUserProvisioned(): Promise<boolean> {
  const { user } = await getCurrentUser({ allData: true });
  return user != null;
}
