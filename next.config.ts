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
  // NOT migrated to the top-level `cacheComponents` flag, despite the
  // deprecation warning on 16.3.x. It is not a rename - cacheComponents is a
  // stricter prerendering mode, and the blocker is a DEPENDENCY, not our code:
  //
  //   Error: Route ".../edit": Next.js encountered URL data `usePathname()`
  //   in a Client Component outside of `<Suspense>`.
  //     at ClerkProvider (app/services/clerk/components/ClerkProvider.tsx:6:5)
  //     at RootLayout (app/layout.tsx:28:5)
  //
  // @clerk/nextjs's ClerkProvider calls usePathname() internally and wraps the
  // whole app from the root layout, so every route fails. Suspending it would
  // mean nothing prerenders at all, and `export const instant = false` per
  // route buys nothing. We are on @clerk/nextjs 6.36.10 against 7.9.1 latest,
  // so the unblocking step is that major upgrade - tracked separately.
  //
  // useCache still works here; this is a deprecation, not a break.
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
