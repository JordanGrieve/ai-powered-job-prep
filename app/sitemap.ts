import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Two entries, and that is not an oversight. Every other route in the app
 * requires a session, so there is nothing else a crawler can legitimately
 * reach. Listing protected routes here would advertise URLs that answer with a
 * redirect, which is worse than not listing them.
 *
 * If the app ever grows public content - guides, example feedback, a blog -
 * those pages go here, and they are also the only realistic route to ranking
 * for anything competitive.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
