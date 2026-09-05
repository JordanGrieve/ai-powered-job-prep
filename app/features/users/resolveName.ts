/**
 * Derives the display name from a Clerk user.
 *
 * Shared by the webhook and by onboarding's direct provisioning so the two
 * paths cannot disagree about what a user is called - whichever wins the race
 * to create the row, the name is the same.
 *
 * Clerk types first_name/last_name as `string | null`, so a naive
 * `${first_name} ${last_name}` persists the literal "null null" into a notNull
 * column for name-less accounts. That string then renders as the avatar
 * initials and is sent to Gemini as the interviewee's name.
 */
export function resolveName(data: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email: string;
}): string {
  const full = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (data.username) return data.username;
  return data.email.split("@")[0];
}
