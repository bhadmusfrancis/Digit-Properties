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
  return 'https://digitproperties.com';
}

export function siteMetadataBase(): URL {
  return new URL(siteOrigin());
}
