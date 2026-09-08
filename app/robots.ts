import type { MetadataRoute } from "next";

const SITE_URL = "https://www.directloopy.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/loop/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
