import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://xotiictech.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/xotiic/", "/support/exotic/", "/support/api/", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
