import mongoose from 'mongoose';
import Listing from '@/models/Listing';
import { LISTING_STATUS } from '@/lib/constants';

export function normalizeDescriptionForDedupe(htmlOrText: string): string {
  if (!htmlOrText || typeof htmlOrText !== 'string') return '';
  return htmlOrText
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeTitleForDedupe(title: string): string {
  return (title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

type ListingLite = {
  _id: unknown;
  title?: string;
  description?: string;
  images?: { public_id?: string }[];
  videos?: { public_id?: string }[];
};

function listingUsesAnyMediaId(
  c: ListingLite,
  incomingIds: Set<string>
): boolean {
  if (incomingIds.size === 0) return false;
  for (const img of c.images || []) {
    const pid = typeof img?.public_id === 'string' ? img.public_id.trim() : '';
    if (pid && incomingIds.has(pid)) return true;
  }
  for (const vid of c.videos || []) {
    const pid = typeof vid?.public_id === 'string' ? vid.public_id.trim() : '';
    if (pid && incomingIds.has(pid)) return true;
  }
  return false;
}

export function findDuplicateAmongCandidates(
  candidates: ListingLite[],
  excludeListingId: string | undefined,
  input: { title: string; description: string; mediaPublicIds: string[] }
): { code: string; message: string } | null {
  const exclude = excludeListingId ? String(excludeListingId) : '';
  const descNorm = normalizeDescriptionForDedupe(input.description);
  const titleNorm = normalizeTitleForDedupe(input.title);
  const incomingIds = new Set(input.mediaPublicIds.filter(Boolean));

  for (const c of candidates) {
    const id = String(c._id);
    if (exclude && id === exclude) continue;

    if (listingUsesAnyMediaId(c, incomingIds)) {
      return {
        code: 'DUPLICATE_MEDIA',
        message:
          'This media is already used on another of your listings. Upload different photos or videos for each property.',
      };
    }

    if (descNorm.length >= 30 && normalizeDescriptionForDedupe(c.description || '') === descNorm) {
      return {
        code: 'DUPLICATE_DESCRIPTION',
        message:
          'You already have a listing with this description. Change the wording before posting again.',
      };
    }

    if (titleNorm.length >= 10 && normalizeTitleForDedupe(c.title || '') === titleNorm) {
      return {
        code: 'DUPLICATE_TITLE',
        message: 'You already have a listing with this title. Use a different title.',
      };
    }
  }
  return null;
}

const DUPLICATE_SCAN_STATUSES = [
  LISTING_STATUS.DRAFT,
  LISTING_STATUS.ACTIVE,
  LISTING_STATUS.PAUSED,
  LISTING_STATUS.PENDING_APPROVAL,
] as const;

export async function findUserListingDuplicate(
  userId: string,
  input: { title: string; description: string; mediaPublicIds: string[] },
  excludeListingId?: string
): Promise<{ code: string; message: string } | null> {
  const filter: Record<string, unknown> = {
    createdBy: new mongoose.Types.ObjectId(userId),
    status: { $in: [...DUPLICATE_SCAN_STATUSES] },
  };
  if (excludeListingId && mongoose.Types.ObjectId.isValid(excludeListingId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeListingId) };
  }

  const candidates = await Listing.find(filter).select('title description images videos').limit(250).lean();

  return findDuplicateAmongCandidates(candidates, excludeListingId, input);
}

export function dedupeImagesByPublicId<T extends { public_id: string }>(images: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const img of images) {
    const id = img.public_id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(img);
  }
  return out;
}

