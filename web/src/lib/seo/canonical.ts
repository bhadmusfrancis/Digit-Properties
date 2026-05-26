import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-metadata';

/** Absolute canonical URL for a site path (leading slash required). */
export function canonicalUrl(path: string): string {
  const origin = siteOrigin();
  if (!path || path === '/') return origin;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export function canonicalAlternates(path: string): Pick<Metadata, 'alternates'> {
  return { alternates: { canonical: canonicalUrl(path) } };
}
