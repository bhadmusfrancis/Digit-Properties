import type { PipelineStage } from 'mongoose';

export type NearLocationParams = {
  suburb?: string;
  city?: string;
  state?: string;
};

/** Administrative proximity score (suburb > city > state), matching trending listings. */
export function buildLocationScoreFields(near: NearLocationParams): Record<string, unknown> {
  const suburb = near.suburb?.trim();
  const city = near.city?.trim();
  const state = near.state?.trim();

  return {
    _locScore: {
      $add: [
        suburb
          ? {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$location.suburb', ''] } }, suburb.toLowerCase()] },
                4,
                0,
              ],
            }
          : 0,
        city
          ? {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$location.city', ''] } }, city.toLowerCase()] },
                3,
                0,
              ],
            }
          : 0,
        state
          ? {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$location.state', ''] } }, state.toLowerCase()] },
                2,
                0,
              ],
            }
          : 0,
      ],
    },
  };
}

export function hasNearLocation(near: NearLocationParams): boolean {
  return Boolean(near.suburb?.trim() || near.city?.trim() || near.state?.trim());
}

/** 1 = still on market; 0 = marked sold or rented (deprioritized in public search). */
export const LISTING_MARKET_AVAILABLE_FIELD = {
  _isMarketAvailable: {
    $cond: {
      if: {
        $or: [
          { $ne: [{ $ifNull: ['$soldAt', null] }, null] },
          { $ne: [{ $ifNull: ['$rentedAt', null] }, null] },
        ],
      },
      then: 0,
      else: 1,
    },
  },
} as const;

export const LISTING_HAS_MEDIA_FIELD = {
  _hasMedia: {
    $cond: {
      if: {
        $or: [
          {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$images', []] },
                    as: 'img',
                    cond: { $gt: [{ $strLenCP: { $ifNull: ['$$img.url', ''] } }, 0] },
                  },
                },
              },
              0,
            ],
          },
          {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$videos', []] },
                    as: 'vid',
                    cond: { $gt: [{ $strLenCP: { $ifNull: ['$$vid.url', ''] } }, 0] },
                  },
                },
              },
              0,
            ],
          },
        ],
      },
      then: 1,
      else: 0,
    },
  },
} as const;

const LISTING_SORT_PRIORITIES = {
  _isMarketAvailable: -1 as const,
  _hasMedia: -1 as const,
};

function listingSortStage(sort: Record<string, 1 | -1>): PipelineStage {
  return { $sort: { ...LISTING_SORT_PRIORITIES, ...sort } } as PipelineStage;
}

export function isListingMarketAvailable(listing: {
  soldAt?: unknown;
  rentedAt?: unknown;
}): boolean {
  return !listing.soldAt && !listing.rentedAt;
}

/** In-memory tie-break: available listings before sold/rented (stable sort). */
export function compareListingMarketAvailable(
  a: { soldAt?: unknown; rentedAt?: unknown },
  b: { soldAt?: unknown; rentedAt?: unknown }
): number {
  const aa = isListingMarketAvailable(a) ? 1 : 0;
  const ab = isListingMarketAvailable(b) ? 1 : 0;
  return ab - aa;
}

export function listingHasRealMedia(listing: {
  images?: Array<{ url?: string }>;
  videos?: Array<{ url?: string }>;
}): boolean {
  const imgOk =
    Array.isArray(listing.images) &&
    listing.images.some((img) => typeof img?.url === 'string' && img.url.trim().length > 0);
  const vidOk =
    Array.isArray(listing.videos) &&
    listing.videos.some((v) => typeof v?.url === 'string' && v.url.trim().length > 0);
  return imgOk || vidOk;
}

/** In-memory tie-break: listings with photos/videos before those without (stable sort). */
export function compareListingHasMedia(
  a: Parameters<typeof listingHasRealMedia>[0],
  b: Parameters<typeof listingHasRealMedia>[0]
): number {
  const ha = listingHasRealMedia(a) ? 1 : 0;
  const hb = listingHasRealMedia(b) ? 1 : 0;
  return hb - ha;
}

export function buildListingSortStage(
  sort: string | undefined,
  options: { hasQuery: boolean; hasNear: boolean; useTextScore: boolean }
): PipelineStage {
  const key = sort || 'default';

  const stableId = { _id: 1 as const };

  if (key === 'relevance' && options.useTextScore) {
    return listingSortStage({ score: -1, boostExpiresAt: -1, createdAt: -1, ...stableId });
  }

  if (key === 'closest' && options.hasNear) {
    return listingSortStage({ _locScore: -1, boostExpiresAt: -1, createdAt: -1, ...stableId });
  }

  switch (key) {
    case 'price_asc':
      return listingSortStage({ price: 1, createdAt: -1, ...stableId });
    case 'price_desc':
      return listingSortStage({ price: -1, createdAt: -1, ...stableId });
    case 'newest':
      return listingSortStage({ createdAt: -1, ...stableId });
    case 'popular':
      return listingSortStage({ viewCount: -1, createdAt: -1, ...stableId });
    case 'relevance':
      return listingSortStage({
        boostExpiresAt: -1,
        highlighted: -1,
        createdAt: -1,
        ...stableId,
      });
    default:
      return listingSortStage({ boostExpiresAt: -1, createdAt: -1, ...stableId });
  }
}
