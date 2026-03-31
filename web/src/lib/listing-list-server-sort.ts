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

const MEDIA_FIRST_SORT = { 'images.0.url': -1 as const };

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
      .sort({ ...MEDIA_FIRST_SORT, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(listingFieldsMy)
      .lean();
  }

  if (sortKey === 'date') {
    return Listing.find(match)
      .sort({ ...MEDIA_FIRST_SORT, createdAt: sortDir })
      .skip(skip)
      .limit(limit)
      .select(listingFieldsMy)
      .lean();
  }

  if (sortKey === 'title') {
    return Listing.find(match)
      .sort({ ...MEDIA_FIRST_SORT, title: sortDir, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(listingFieldsMy)
      .lean();
  }

  if (sortKey === 'price') {
    return Listing.find(match)
      .sort({ ...MEDIA_FIRST_SORT, price: sortDir, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(listingFieldsMy)
      .lean();
  }

  const pipeline: PipelineStage[] = [{ $match: match }];
  pipeline.push({
    $addFields: {
      _sortHasThumb: {
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
    },
  });

  if (sortKey === 'image') {
    pipeline.push({ $sort: { _sortHasThumb: -1, createdAt: -1 } });
  } else if (sortKey === 'status') {
    pipeline.push({
      $addFields: {
        _sortStatus: {
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
        },
      },
    });
    pipeline.push({ $sort: { _sortHasThumb: -1, _sortStatus: sortDir, createdAt: -1 } });
  } else {
    // Fallback to createdAt ordering if an unexpected sortKey arrives.
    return Listing.find(match)
      .sort({ ...MEDIA_FIRST_SORT, createdAt: sortDir })
      .skip(skip)
      .limit(limit)
      .select(listingFieldsMy)
      .lean();
  }

  pipeline.push({ $skip: skip }, { $limit: limit });
  pipeline.push({
    $project: {
      _sortHasThumb: 0,
      _sortStatus: 0,
    },
  });

  return Listing.aggregate(pipeline).allowDiskUse(true);
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
      .sort({ ...MEDIA_FIRST_SORT, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .select(listingFieldsAdmin)
      .lean();
  }

  if (sortKey === 'date') {
    return Listing.find(match)
      .sort({ ...MEDIA_FIRST_SORT, createdAt: sortDir })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .select(listingFieldsAdmin)
      .lean();
  }

  if (sortKey === 'title') {
    return Listing.find(match)
      .sort({ ...MEDIA_FIRST_SORT, title: sortDir, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .select(listingFieldsAdmin)
      .lean();
  }

  if (sortKey === 'price') {
    return Listing.find(match)
      .sort({ ...MEDIA_FIRST_SORT, price: sortDir, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .select(listingFieldsAdmin)
      .lean();
  }

  const pipeline: PipelineStage[] = [{ $match: match }];
  pipeline.push({
    $addFields: {
      _sortHasThumb: {
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
    },
  });

  if (sortKey === 'image') {
    pipeline.push({ $sort: { _sortHasThumb: -1, createdAt: -1 } });
  } else if (sortKey === 'status') {
    pipeline.push({
      $addFields: {
        _sortStatus: {
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
        },
      },
    });
    pipeline.push({ $sort: { _sortHasThumb: -1, _sortStatus: sortDir, createdAt: -1 } });
  } else {
    return Listing.find(match)
      .sort({ ...MEDIA_FIRST_SORT, createdAt: sortDir })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .select(listingFieldsAdmin)
      .lean();
  }

  pipeline.push({ $skip: skip }, { $limit: limit });
  pipeline.push({
    $lookup: {
      from: userColl,
      localField: 'createdBy',
      foreignField: '_id',
      as: '_createdByArr',
    },
  });
  pipeline.push({
    $addFields: {
      createdBy: { $arrayElemAt: ['$_createdByArr', 0] },
    },
  });
  pipeline.push({
    $project: {
      _sortHasThumb: 0,
      _sortStatus: 0,
      _createdByArr: 0,
    },
  });

  return Listing.aggregate(pipeline).allowDiskUse(true);
}
