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

export const LISTING_HAS_MEDIA_FIELD = {
  _hasMedia: {
    $cond: {
      if: {
        $or: [
          {
            $and: [
              { $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] },
              { $ne: [{ $ifNull: ['$images.0.url', ''] }, ''] },
            ],
          },
          {
            $and: [
              { $gt: [{ $size: { $ifNull: ['$videos', []] } }, 0] },
              { $ne: [{ $ifNull: ['$videos.0.url', ''] }, ''] },
            ],
          },
        ],
      },
      then: 1,
      else: 0,
    },
  },
} as const;

export function buildListingSortStage(
  sort: string | undefined,
  options: { hasQuery: boolean; hasNear: boolean; useTextScore: boolean }
): PipelineStage {
  const key = sort || 'default';

  if (key === 'relevance' && options.useTextScore) {
    return { $sort: { score: -1, _hasMedia: -1, boostExpiresAt: -1, createdAt: -1 } } as PipelineStage;
  }

  if (key === 'closest' && options.hasNear) {
    return { $sort: { _locScore: -1, _hasMedia: -1, boostExpiresAt: -1, createdAt: -1 } } as PipelineStage;
  }

  switch (key) {
    case 'price_asc':
      return { $sort: { _hasMedia: -1, price: 1, createdAt: -1 } } as PipelineStage;
    case 'price_desc':
      return { $sort: { _hasMedia: -1, price: -1, createdAt: -1 } } as PipelineStage;
    case 'newest':
      return { $sort: { _hasMedia: -1, createdAt: -1 } } as PipelineStage;
    case 'popular':
      return { $sort: { _hasMedia: -1, viewCount: -1, createdAt: -1 } } as PipelineStage;
    case 'relevance':
      return { $sort: { _hasMedia: -1, boostExpiresAt: -1, highlighted: -1, createdAt: -1 } } as PipelineStage;
    default:
      return { $sort: { _hasMedia: -1, boostExpiresAt: -1, createdAt: -1 } } as PipelineStage;
  }
}
