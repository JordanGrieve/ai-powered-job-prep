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
