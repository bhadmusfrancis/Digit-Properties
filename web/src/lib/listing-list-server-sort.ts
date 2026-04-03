import mongoose, { type PipelineStage } from 'mongoose';
import Listing from '@/models/Listing';
import User from '@/models/User';
import type { ListingSortKey } from '@/lib/sort-listing-rows';

const listingFieldsMy =
  'title price status listingType rentPeriod propertyType images videos featured highlighted soldAt rentedAt createdAt';

/**
 * Aggregation $match does not cast string → ObjectId like Mongoose find() does.
 * Without this, filtering by createdBy returns zero documents.
 */
function createdByMatchValue(ownerId: string) {
  if (mongoose.Types.ObjectId.isValid(ownerId)) {
    return new mongoose.Types.ObjectId(ownerId);
  }
  return ownerId;
}

function matchOwner(ownerId: string) {
  return { createdBy: createdByMatchValue(ownerId) };
}

/** For “Sort by image” aggregation only — not used as a tiebreaker for title/price/date/status. */
const LISTING_AGG_MEDIA_THUMB_EXPR = {
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
};

const LISTING_AGG_STATUS_RANK_EXPR = {
  $switch: {
    branches: [
      { case: { $eq: ['$status', 'draft'] }, then: 0 },
      { case: { $eq: ['$status', 'pending_approval'] }, then: 1 },
      { case: { $eq: ['$status', 'active'] }, then: 2 },
      { case: { $eq: ['$status', 'paused'] }, then: 3 },
      { case: { $eq: ['$status', 'closed'] }, then: 4 },
    ],
    default: 99,
  },
};

function adminCreatedByLookupStages(userColl: string): PipelineStage[] {
  return [
    {
      $lookup: {
        from: userColl,
        localField: 'createdBy',
        foreignField: '_id',
        as: '_createdByArr',
      },
    },
    {
      $addFields: {
        createdBy: { $arrayElemAt: ['$_createdByArr', 0] },
      },
    },
  ];
}

/** Dashboard “My Properties”: sort entire set in DB, then paginate. */
export async function fetchMyListingsPage(
  ownerId: string,
  sortKey: ListingSortKey,
  sortAsc: boolean,
  skip: number,
  limit: number
) {
  const match = matchOwner(ownerId);
  const sortDir = sortAsc ? 1 : -1;

  if (sortKey === 'default') {
    return Listing.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(listingFieldsMy)
      .lean();
  }

  if (sortKey === 'date') {
    return Listing.find(match)
      .sort({ createdAt: sortDir })
      .skip(skip)
      .limit(limit)
      .select(listingFieldsMy)
      .lean();
  }

  if (sortKey === 'title') {
    return Listing.find(match)
      .sort({ title: sortDir, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(listingFieldsMy)
      .lean();
  }

  if (sortKey === 'price') {
    return Listing.find(match)
      .sort({ price: sortDir, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(listingFieldsMy)
      .lean();
  }

  if (sortKey === 'image') {
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $addFields: { _sortHasThumb: LISTING_AGG_MEDIA_THUMB_EXPR } },
      { $sort: { _sortHasThumb: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { _sortHasThumb: 0 } },
    ];
    return Listing.aggregate(pipeline).allowDiskUse(true);
  }

  if (sortKey === 'status') {
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $addFields: { _sortStatus: LISTING_AGG_STATUS_RANK_EXPR } },
      { $sort: { _sortStatus: sortDir, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { _sortStatus: 0 } },
    ];
    return Listing.aggregate(pipeline).allowDiskUse(true);
  }

  return Listing.find(match)
    .sort({ createdAt: sortDir })
    .skip(skip)
    .limit(limit)
    .select(listingFieldsMy)
    .lean();
}

const listingFieldsAdmin =
  'title price status listingType rentPeriod propertyType location images videos featured highlighted createdBy createdAt';

/** Admin listings: sort entire set in DB, then paginate; populate createdBy via $lookup. */
export async function fetchAdminListingsPage(
  sortKey: ListingSortKey,
  sortAsc: boolean,
  skip: number,
  limit: number
) {
  const match = {};
  const sortDir = sortAsc ? 1 : -1;
  const userColl = User.collection.name;

  if (sortKey === 'default') {
    return Listing.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .select(listingFieldsAdmin)
      .lean();
  }

  if (sortKey === 'date') {
    return Listing.find(match)
      .sort({ createdAt: sortDir })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .select(listingFieldsAdmin)
      .lean();
  }

  if (sortKey === 'title') {
    return Listing.find(match)
      .sort({ title: sortDir, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .select(listingFieldsAdmin)
      .lean();
  }

  if (sortKey === 'price') {
    return Listing.find(match)
      .sort({ price: sortDir, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .select(listingFieldsAdmin)
      .lean();
  }

  if (sortKey === 'image') {
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $addFields: { _sortHasThumb: LISTING_AGG_MEDIA_THUMB_EXPR } },
      { $sort: { _sortHasThumb: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      ...adminCreatedByLookupStages(userColl),
      {
        $project: {
          _sortHasThumb: 0,
          _createdByArr: 0,
        },
      },
    ];
    return Listing.aggregate(pipeline).allowDiskUse(true);
  }

  if (sortKey === 'status') {
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $addFields: { _sortStatus: LISTING_AGG_STATUS_RANK_EXPR } },
      { $sort: { _sortStatus: sortDir, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      ...adminCreatedByLookupStages(userColl),
      {
        $project: {
          _sortStatus: 0,
          _createdByArr: 0,
        },
      },
    ];
    return Listing.aggregate(pipeline).allowDiskUse(true);
  }

  return Listing.find(match)
    .sort({ createdAt: sortDir })
    .skip(skip)
    .limit(limit)
    .populate('createdBy', 'name email')
    .select(listingFieldsAdmin)
    .lean();
}
