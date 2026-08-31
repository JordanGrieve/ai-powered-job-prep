import { auth } from "@clerk/nextjs/server";

/**
 * Clerk Billing feature slugs. These are dashboard state, NOT repo state -
 * see the "Clerk Billing" section of the README, which documents which plan
 * tier carries each slug and which are still unenforced. Keep the two in sync.
 *
 * Note that with no Billing plans configured, every has() returns false, so
 * canCreateInterview() is always false and nobody can start an interview -
 * while the app otherwise looks healthy.
 */
type Permission =
  // Enforced today.
  | "unlimited_interviews"
  | "1_interview"
  // Declared and sold, but no callers yet.
  | "unlimited_resume_analysis"
  | "unlimited_questions"
  | "5_questions";

export async function hasPermission(permission: Permission) {
  const { has } = await auth();
  return has({ feature: permission });
}
