/**
 * The site's public origin, for metadataBase, robots and the sitemap.
 *
 * Deliberately NOT part of app/data/env/*. Those modules fail fast when a
 * variable is missing, which is right for a database URL or an API key - the
 * app genuinely cannot work without them. This one has a correct fallback on
 * every deployment target, so making it required would turn a local `npm run
 * dev` into a setup error for no benefit.
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_SITE_URL      - set this once a custom domain exists.
 *  2. VERCEL_PROJECT_PRODUCTION_URL - Vercel injects the production alias, so
 *     preview deployments still emit canonical URLs pointing at production
 *     rather than at their own throwaway hostname. That is what you want:
 *     previews must never compete with production in the index.
 *  3. localhost, for development.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

/**
 * True only on the real production deployment. Preview and development builds
 * must not be indexable - a preview URL ranking for your own brand term is a
 * genuine and fairly common own goal.
 */
export const IS_PRODUCTION_DEPLOYMENT =
  process.env.VERCEL_ENV === "production" ||
  (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);
