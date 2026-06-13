import mongoose from 'mongoose';
import User from '@/models/User';

const MAX_SEARCH_LEN = 200;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  ];

  if (mongoose.Types.ObjectId.isValid(q) && String(new mongoose.Types.ObjectId(q)) === q) {
    or.push({ _id: new mongoose.Types.ObjectId(q) });
  }

  const matchingUsers = await User.find({
    $or: [{ name: regex }, { email: regex }],
  })
    .select('_id')
    .limit(100)
    .lean();

  if (matchingUsers.length > 0) {
    or.push({ createdBy: { $in: matchingUsers.map((u) => u._id) } });
  }

  return { $or: or };
}
