import type { MetadataRoute } from "next";
import { SITE_URL, IS_PRODUCTION_DEPLOYMENT } from "@/lib/siteUrl";

/**
 * Only four routes are public (see proxy.ts): "/", "/sign-in", "/sign-up" and
 * "/privacy". Everything else is behind auth.protect() and would return a
 * redirect to a crawler, so it is disallowed explicitly rather than left to be
 * discovered - a crawl budget spent on redirect chains is wasted.
 *
 * The sign-in and sign-up routes are excluded on purpose: they are functional
 * pages with no content to rank, and letting them into the index means the
 * brand query can surface a login form instead of the landing page.
 */
export default function robots(): MetadataRoute.Robots {
  // Preview deployments must not be crawlable. Without this, a preview URL can
  // be indexed and then compete with production for the brand term.
  if (!IS_PRODUCTION_DEPLOYMENT) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/onboarding", "/sign-in", "/sign-up", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
