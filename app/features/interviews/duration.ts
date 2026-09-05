/**
 * Hard ceiling on a single voice interview.
 *
 * Hume EVI bills per MINUTE of connected audio (~$0.07/min), while every
 * Gemini call around it costs fractions of a cent - so the length of a call is
 * essentially the entire unit cost of this product. Nothing else in the app
 * bounds it: `unlimited_interviews` is genuinely unlimited, so without a cap a
 * single forgotten tab left connected bills indefinitely.
 *
 * 20 minutes is longer than a real screening call and puts a known worst case
 * (~$1.40) on one interview, which is what makes the Pro tier's economics
 * predictable rather than open-ended.
 */
export const MAX_INTERVIEW_SECONDS = 20 * 60;

/** Show the countdown in a warning state for the last two minutes. */
export const INTERVIEW_WARNING_SECONDS = 2 * 60;

/**
 * Parses Hume's `callDurationTimestamp`, which is "HH:MM:SS" - the same shape
 * updateInterview's schema enforces.
 *
 * Returns null rather than throwing or coercing to 0 for anything unparseable:
 * a null reads as "we don't know how long this call has been running", and the
 * caller must NOT treat that as "0 seconds elapsed" and keep the call open
 * forever. Hume sends null itself before the first tick.
 */
export function parseDurationToSeconds(timestamp: string | null): number | null {
  if (timestamp == null) return null;

  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(timestamp);
  if (match == null) return null;

  const [, hours, minutes, seconds] = match;
  const m = Number(minutes);
  const s = Number(seconds);

  // "00:75:00" matches the regex but is not a real timestamp.
  if (m > 59 || s > 59) return null;

  return Number(hours) * 3600 + m * 60 + s;
}

/** Seconds left before the cap, floored at 0. */
export function remainingSeconds(elapsed: number): number {
  return Math.max(0, MAX_INTERVIEW_SECONDS - elapsed);
}

/** Formats a remaining-seconds count as M:SS for the in-call countdown. */
export function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
