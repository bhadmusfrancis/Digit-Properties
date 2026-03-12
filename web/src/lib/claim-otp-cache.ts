/**
 * In-memory cache for claim flow OTP: pinId -> { userId, phone, listingId, expiresAt }.
 * Used so that after Termii verify we know which phone was verified (Termii doesn't return it).
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes

type Entry = {
  userId: string;
  phone: string;
  listingId: string;
  expiresAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __claimOtpCache: Map<string, Entry> | undefined;
}

function getCache(): Map<string, Entry> {
  if (typeof globalThis.__claimOtpCache === 'undefined') {
    globalThis.__claimOtpCache = new Map();
  }
  return globalThis.__claimOtpCache;
}

function prune() {
  const cache = getCache();
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt < now) cache.delete(k);
  }
}

export function setClaimOtp(pinId: string, userId: string, phone: string, listingId: string): void {
  prune();
  getCache().set(pinId, {
    userId,
    phone,
    listingId,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function getAndDeleteClaimOtp(pinId: string): Entry | null {
  prune();
  const cache = getCache();
  const entry = cache.get(pinId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(pinId);
    return null;
  }
  cache.delete(pinId);
  return entry;
}
