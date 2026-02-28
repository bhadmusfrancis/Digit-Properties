import { NextResponse } from 'next/server';
import type { PipelineStage } from 'mongoose';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { LISTING_STATUS } from '@/lib/constants';

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const suburb = searchParams.get('suburb')?.trim();
    const city = searchParams.get('city')?.trim();
    const state = searchParams.get('state')?.trim();

    const match: Record<string, unknown> = { status: LISTING_STATUS.ACTIVE };
    const hasLocation = suburb || city || state;

    if (!hasLocation) {
      const listings = await Listing.find(match)
        .sort({ viewCount: -1, createdAt: -1 })
        .limit(limit)
        .populate('createdBy', 'name image role')
        .lean();
      return NextResponse.json({
        listings: listings.map((l) => ({
          ...l,
          createdBy: l.createdBy && typeof l.createdBy === 'object' && 'role' in l.createdBy
            ? { name: (l.createdBy as { name?: string }).name, image: (l.createdBy as { image?: string }).image, role: (l.createdBy as { role?: string }).role }
            : l.createdBy,
          isBoosted: l.boostExpiresAt && new Date(l.boostExpiresAt) > new Date(),
        })),
      });
    }

    const aggPipeline: PipelineStage[] = [
      { $match: match },
      {
        $addFields: {
          _locScore: {
            $add: [
              suburb
                ? { $cond: [{ $eq: [{ $toLower: { $ifNull: ['$location.suburb', ''] } }, suburb.toLowerCase()] }, 4, 0] }
                : 0,
              city ? { $cond: [{ $eq: [{ $toLower: '$location.city' }, city.toLowerCase()] }, 3, 0] } : 0,
              state ? { $cond: [{ $eq: [{ $toLower: '$location.state' }, state.toLowerCase()] }, 2, 0] } : 0,
            ],
          },
        },
      },
      { $sort: { _locScore: -1, viewCount: -1, createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdByDoc',
          pipeline: [{ $project: { name: 1, image: 1, role: 1 } }],
        },
      },
      { $set: { createdBy: { $arrayElemAt: ['$createdByDoc', 0] } } },
      { $unset: ['createdByDoc', '_locScore'] },
    ];

    const listings = await Listing.aggregate(aggPipeline);
    const mapped = listings.map((l: { createdBy?: unknown; boostExpiresAt?: Date }) => ({
      ...l,
      createdBy: l.createdBy && typeof l.createdBy === 'object' && 'role' in l.createdBy
        ? { name: (l.createdBy as { name?: string }).name, image: (l.createdBy as { image?: string }).image, role: (l.createdBy as { role?: string }).role }
        : l.createdBy,
      isBoosted: l.boostExpiresAt && new Date(l.boostExpiresAt) > new Date(),
    }));

    return NextResponse.json({ listings: mapped });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ listings: [] });
  }
}
