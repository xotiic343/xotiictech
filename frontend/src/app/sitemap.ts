import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://xotiictech.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/bots`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/store`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/vendingx`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/status`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/licenses`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/refund-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
