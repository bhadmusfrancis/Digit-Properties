import mongoose from 'mongoose';
import User from '@/models/User';

const MAX_SEARCH_LEN = 200;
const MIN_PHONE_DIGITS = 4;
const NIGERIAN_PREFIX = '234';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Digit strings useful for matching stored phones (234…, 0…, local 10-digit). */
export function extractPhoneDigitVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < MIN_PHONE_DIGITS) return [];

  const variants = new Set<string>();
  variants.add(digits);

  if (digits.startsWith(NIGERIAN_PREFIX) && digits.length >= 13) {
    variants.add(digits.slice(0, 13));
    variants.add(digits.slice(3, 13));
  } else if (digits.startsWith('0') && digits.length >= 11) {
    variants.add(digits.slice(1, 11));
    variants.add(NIGERIAN_PREFIX + digits.slice(1, 11));
  } else if (digits.length === 10) {
    variants.add(NIGERIAN_PREFIX + digits);
    variants.add('0' + digits);
  }

  return [...variants].filter((v) => v.length >= MIN_PHONE_DIGITS);
}

export function normalizeAdminListingSearchQuery(raw?: string | null): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_SEARCH_LEN);
}

export function parseAdminListingSearchFromSearchParams(sp: {
  q?: string | string[];
}): string {
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return normalizeAdminListingSearchQuery(raw);
}

/** MongoDB $match filter for admin listing search (empty object when no query). */
export async function buildAdminListingSearchMatch(
  rawQuery?: string | null
): Promise<Record<string, unknown>> {
  const q = normalizeAdminListingSearchQuery(rawQuery);
  if (!q) return {};

  const regex = new RegExp(escapeRegex(q), 'i');
  const or: Record<string, unknown>[] = [
    { title: regex },
    { description: regex },
    { tags: regex },
    { 'location.address': regex },
    { 'location.city': regex },
    { 'location.suburb': regex },
    { 'location.state': regex },
    { status: regex },
    { listingType: regex },
    { propertyType: regex },
    { agentName: regex },
    { agentPhone: regex },
    { agentEmail: regex },
  ];

  for (const variant of extractPhoneDigitVariants(q)) {
    const phoneRegex = new RegExp(escapeRegex(variant));
    or.push({ agentPhone: phoneRegex });
  }

  if (mongoose.Types.ObjectId.isValid(q) && String(new mongoose.Types.ObjectId(q)) === q) {
    or.push({ _id: new mongoose.Types.ObjectId(q) });
  }

  const userOr: Record<string, unknown>[] = [
    { name: regex },
    { email: regex },
    { firstName: regex },
    { lastName: regex },
    { phone: regex },
  ];
  for (const variant of extractPhoneDigitVariants(q)) {
    userOr.push({ phone: new RegExp(escapeRegex(variant)) });
  }

  const matchingUsers = await User.find({ $or: userOr })
    .select('_id')
    .limit(100)
    .lean();

  if (matchingUsers.length > 0) {
    or.push({ createdBy: { $in: matchingUsers.map((u) => u._id) } });
  }

  return { $or: or };
}
