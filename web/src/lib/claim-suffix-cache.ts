/**
 * After user enters correct last-5 digits, allow OTP send for that listing/phone.
 */

const TTL_MS = 15 * 60 * 1000;

type Entry = {
  userId: string;
  phone: string;
  listingId: string;
  expiresAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __claimSuffixCache: Map<string, Entry> | undefined;
}

function cacheKey(userId: string, listingId: string): string {
  return `${userId}:${listingId}`;
}

function getCache(): Map<string, Entry> {
  if (typeof globalThis.__claimSuffixCache === 'undefined') {
    globalThis.__claimSuffixCache = new Map();
  }
  return globalThis.__claimSuffixCache;
}

function prune() {
  const cache = getCache();
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt < now) cache.delete(k);
  }
}

export function setClaimSuffixVerified(userId: string, phone: string, listingId: string): void {
  prune();
  getCache().set(cacheKey(userId, listingId), {
    userId,
    phone,
    listingId,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function getClaimSuffixVerified(userId: string, listingId: string): Entry | null {
  prune();
  const entry = getCache().get(cacheKey(userId, listingId));
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    getCache().delete(cacheKey(userId, listingId));
    return null;
  }
  return entry;
}

export function clearClaimSuffixVerified(userId: string, listingId: string): void {
  prune();
  getCache().delete(cacheKey(userId, listingId));
}
