/** In-memory rate limit: max attempts per key within windowMs. For production consider Redis (e.g. @upstash/ratelimit). */
const store = new Map<string, { count: number; resetAt: number }>();

/** Same caps as /api/me/verify-phone OTP send. */
export const PHONE_OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PHONE_OTP_RATE_LIMIT_MAX_ATTEMPTS = 5;

const WINDOW_MS = PHONE_OTP_RATE_LIMIT_WINDOW_MS;
const MAX_ATTEMPTS = PHONE_OTP_RATE_LIMIT_MAX_ATTEMPTS;

function getKey(identifier: string, prefix: string): string {
  return `${prefix}:${identifier}`;
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  if (realIp) return realIp;
  return 'unknown';
}

/** Consume one attempt for this request. Returns allowed: false if over limit (with retryAfter seconds). */
export function consumeRateLimit(req: Request, prefix: string): { allowed: boolean; retryAfter?: number } {
  const key = getKey(getClientIdentifier(req), prefix);
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return { allowed: true };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true };
}
