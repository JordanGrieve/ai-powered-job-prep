/**
 * Route params for every page under /app/job-infos/[jobinfoid].
 *
 * Passed around as a PROMISE rather than awaited in the page component.
 * Under `cacheComponents`, awaiting params at the top of a page is runtime
 * data outside a Suspense boundary and blocks the route from prerendering:
 *
 *   Error: Next.js encountered uncached or runtime data during prerendering.
 *     at JobInfoNewPage (.../edit/page.tsx)
 *
 * So the page stays synchronous, renders its shell immediately, and hands the
 * promise to a suspended child that awaits it.
 */
export type JobInfoParams = Promise<{ jobinfoid: string }>;

export type InterviewParams = Promise<{
  jobinfoid: string;
  interviewId: string;
}>;
