const UNKNOWN_COUNTRY = 'XX';

/** ISO 3166-1 alpha-2 from common edge/CDN headers (Vercel, Cloudflare, etc.). */
export function getRequestCountryCode(req: Request): string {
  const candidates = [
    req.headers.get('x-vercel-ip-country'),
    req.headers.get('cf-ipcountry'),
    req.headers.get('x-country-code'),
    req.headers.get('cloudfront-viewer-country'),
  ];
  for (const raw of candidates) {
    const code = raw?.trim().toUpperCase();
    if (code && code.length === 2 && code !== 'T1') return code;
  }
  return UNKNOWN_COUNTRY;
}

export function countryDisplayName(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!normalized || normalized === UNKNOWN_COUNTRY) return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

/** Regional indicator symbols for a two-letter ISO country code. */
export function countryFlagEmoji(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!normalized || normalized.length !== 2 || normalized === UNKNOWN_COUNTRY) return '🌍';
  const chars = [...normalized];
  if (!chars.every((c) => c >= 'A' && c <= 'Z')) return '🌍';
  return String.fromCodePoint(...chars.map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}
