import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-metadata';

/**
 * Crawl rules for public search engines.
 * Private app areas use layout noindex; edit URLs use noindex on /listings/[id]/edit
 * (avoid wildcard disallow here — some parsers over-match /listings/*).
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/admin/',
        '/auth/',
        '/api/',
        '/listings/new',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
