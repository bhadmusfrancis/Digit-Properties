import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-metadata';

export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/admin/', '/auth/', '/api/', '/listings/new', '/listings/*/edit'],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
