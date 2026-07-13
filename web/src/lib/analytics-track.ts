const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor/i;

const SKIP_PREFIXES = [
  '/api/',
  '/_next/',
  '/auth/',
  '/admin/',
  '/dashboard/',
  '/favicon',
  '/logo',
  '/avatar-',
  '/robots.txt',
  '/sitemap',
];

export function shouldTrackPath(pathname: string): boolean {
  if (!pathname || pathname === '') return false;
  if (!pathname.startsWith('/')) return false;
  if (pathname.includes('.')) return false;
  return !SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_PATTERN.test(userAgent);
}

export function normalizeReferrer(referrer: string | null | undefined): string | undefined {
  if (!referrer?.trim()) return undefined;
  try {
    const url = new URL(referrer);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.digitproperties.com') || host === 'digitproperties.com') {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}
