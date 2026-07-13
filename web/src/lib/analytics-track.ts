import type { Types } from 'mongoose';

const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor/i;

/** Paths never counted as public website traffic. */
const INTERNAL_PREFIXES = [
  '/api/',
  '/_next/',
  '/auth/',
  '/admin',
  '/dashboard',
  '/favicon',
  '/logo',
  '/avatar-',
  '/robots.txt',
  '/sitemap',
];

const INTERNAL_PATH_REGEX = /^\/(admin|dashboard|auth|api)(\/|$)/;

export function shouldTrackPath(pathname: string): boolean {
  if (!pathname || pathname === '') return false;
  if (!pathname.startsWith('/')) return false;
  if (pathname.includes('.')) return false;
  return !INTERNAL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isPublicTrafficPath(pathname: string): boolean {
  return shouldTrackPath(pathname);
}

export function isInternalTrafficPath(pathname: string): boolean {
  if (!pathname?.startsWith('/')) return true;
  return INTERNAL_PATH_REGEX.test(pathname);
}

export function buildPublicTrafficFilter(
  since: Date,
  adminUserIds: Types.ObjectId[] = []
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    createdAt: { $gte: since },
    path: { $not: INTERNAL_PATH_REGEX },
  };
  if (adminUserIds.length > 0) {
    filter.$or = [
      { userId: { $exists: false } },
      { userId: null },
      { userId: { $nin: adminUserIds } },
    ];
  }
  return filter;
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
    if (
      host === 'localhost' ||
      host.endsWith('.digitproperties.com') ||
      host === 'digitproperties.com' ||
      host === 'www.digitproperties.com'
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

export type TrafficSource = 'direct' | 'search' | 'social' | 'referral';

const SEARCH_HOSTS = ['google.', 'bing.', 'yahoo.', 'duckduckgo.', 'baidu.', 'yandex.'];
const SOCIAL_HOSTS = [
  'facebook.',
  'fb.',
  'twitter.',
  't.co',
  'instagram.',
  'linkedin.',
  'tiktok.',
  'pinterest.',
  'reddit.',
  'youtube.',
];

export function classifyTrafficSource(referrer: string | null | undefined): TrafficSource {
  if (!referrer?.trim()) return 'direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (SEARCH_HOSTS.some((h) => host.includes(h))) return 'search';
    if (SOCIAL_HOSTS.some((h) => host.includes(h))) return 'social';
    return 'referral';
  } catch {
    return 'referral';
  }
}

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function deviceFromUserAgent(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook/.test(ua)) return 'tablet';
  if (/mobile|iphone|android.*mobile|windows phone/.test(ua)) return 'mobile';
  return 'desktop';
}

export function humanizePath(path: string): string {
  if (path === '/') return 'Homepage';
  if (path === '/listings') return 'Property listings';
  if (path === '/listings/new') return 'List a property';
  if (path === '/trends') return 'Trends & insights';
  if (path === '/about') return 'About us';
  if (path === '/contact') return 'Contact';
  if (path.startsWith('/listings/')) {
    if (path.includes('/video/')) return 'Listing video';
    return 'Listing detail';
  }
  if (path.startsWith('/trends/')) return 'Trend article';
  if (path.startsWith('/listings/in/')) return 'Location landing';
  return path;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
