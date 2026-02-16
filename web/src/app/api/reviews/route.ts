import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Review from '@/models/Review';
import Listing from '@/models/Listing';
import { reviewSchema } from '@/lib/validations';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const revieweeId = searchParams.get('revieweeId');
    const listingId = searchParams.get('listingId');

    if (!revieweeId && !listingId) {
      return NextResponse.json({ error: 'revieweeId or listingId required' }, { status: 400 });
    }

    await dbConnect();
    const filter: Record<string, mongoose.Types.ObjectId | string> = { status: 'active' };
    if (revieweeId) filter.revieweeId = new mongoose.Types.ObjectId(revieweeId);
    if (listingId) filter.listingId = new mongoose.Types.ObjectId(listingId);

    const reviews = await Review.find(filter)
      .populate('reviewerId', 'name image')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const stats = await Review.aggregate([
      { $match: filter },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    return NextResponse.json({
      reviews,
      stats: stats[0] ? { avgRating: stats[0].avg, totalReviews: stats[0].count } : { avgRating: 0, totalReviews: 0 },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findById(parsed.data.listingId);
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    if (!listing.soldAt && !listing.rentedAt) {
      return NextResponse.json({ error: 'Listing must be sold or rented before rating' }, { status: 400 });
    }
    if (listing.createdBy.toString() !== parsed.data.revieweeId) {
      return NextResponse.json({ error: 'Invalid reviewee' }, { status: 400 });
    }

    const existing = await Review.findOne({
      listingId: parsed.data.listingId,
      reviewerId: session.user.id,
    });
    if (existing) {
      return NextResponse.json({ error: 'You have already reviewed this listing' }, { status: 400 });
    }

    const review = await Review.create({
      ...parsed.data,
      reviewerId: session.user.id,
      status: 'active',
    });

    return NextResponse.json(review);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
