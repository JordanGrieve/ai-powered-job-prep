import type { NextConfig } from "next";

/**
 * Content-Security-Policy is shipped in report-only mode first. Flip the header
 * name to "Content-Security-Policy" once /app/upgrade (Clerk's PricingTable)
 * and a live interview page with the mic active both report zero violations.
 *
 * 'unsafe-inline'/'unsafe-eval' on script-src are what Clerk's and Next's
 * runtime currently need; tightening those to a nonce is a separate job.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://img.clerk.com https://*.clerk.com",
  "font-src 'self' data:",
  // Hume EVI runs over a websocket; Clerk and Arcjet are plain XHR.
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.hume.ai wss://api.hume.ai https://*.arcjet.com",
  "media-src 'self' blob: https://api.hume.ai",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
].join("; ");

const nextConfig: NextConfig = {
  // Still on the deprecated `experimental.useCache` rather than the top-level
  // `cacheComponents` flag - but the reason has CHANGED, and the remaining
  // work is now ours rather than a dependency's.
  //
  // Previously blocked by @clerk/nextjs v6, whose ClerkProvider called
  // usePathname() internally and wrapped the whole app from the root layout,
  // failing every route with CLIENT_HOOK_DYNAMIC. The v7 upgrade fixed that.
  //
  // What blocks it now:
  //
  //   Error: Route ".../edit": Next.js encountered uncached or runtime data
  //   during prerendering.
  //     at JobInfoNewPage (app/app/job-infos/[jobinfoid]/edit/page.tsx:19:25)
  //
  // Four dynamic routes `await params` at the top of the page component.
  // Under cacheComponents that is runtime data outside a Suspense boundary,
  // so the page must instead pass the params promise down to a suspended
  // child. That is a real refactor of every dynamic page and does not belong
  // inside an auth-library upgrade.
  //
  // useCache still works on 16.3.3; this is a deprecation, not a break.
  experimental: {
    useCache: true,
    serverActions: {
      // Resume uploads go through a server action; the default cap is 1MB.
      bodySizeLimit: "6mb",
    },
  },
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Full URLs carry interview and job-info UUIDs; do not leak them
          // cross-origin in the Referer header.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
