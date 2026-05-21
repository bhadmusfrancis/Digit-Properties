/** Canonical site origin for URLs, Open Graph, and metadataBase (no trailing path). */
export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* ignore */
    }
  }
  // Production Vercel redirects apex → www; canonicals/sitemap must match the live host.
  return 'https://www.digitproperties.com';
}

export function siteMetadataBase(): URL {
  return new URL(siteOrigin());
}
