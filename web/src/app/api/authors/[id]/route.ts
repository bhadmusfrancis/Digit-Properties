import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import Listing from '@/models/Listing';
import Review from '@/models/Review';
import AuthorLike from '@/models/AuthorLike';
import { LISTING_STATUS } from '@/lib/constants';
import { isPublicVerifiedAccount, shapePublicCreatedBy } from '@/lib/verification';

const PUBLIC_USER_SELECT =
  'firstName name image role companyPosition verifiedAt phoneVerifiedAt identityVerifiedAt livenessVerifiedAt';

/** GET /api/authors/[id] — public profile, stats, and active listings for an author (listing creator). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid author ID' }, { status: 400 });
    }
    await dbConnect();
    const authorOid = new mongoose.Types.ObjectId(id);
    const user = await User.findById(id).select(PUBLIC_USER_SELECT).lean();
    if (!user) return NextResponse.json({ error: 'Author not found' }, { status: 404 });

    const [listings, totalListings, likeCount, reviewAgg] = await Promise.all([
      Listing.find({ createdBy: authorOid, status: LISTING_STATUS.ACTIVE })
        .sort({ 'images.0.url': -1, createdAt: -1 })
        .limit(24)
        .select('title price listingType rentPeriod propertyType location bedrooms bathrooms images videos slug')
        .lean(),
      Listing.countDocuments({ createdBy: authorOid, status: LISTING_STATUS.ACTIVE }),
      AuthorLike.countDocuments({ authorId: authorOid }),
      Review.aggregate([
        { $match: { revieweeId: authorOid, status: 'active' } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ]);

    const shaped = shapePublicCreatedBy(user);
    if (!shaped) return NextResponse.json({ error: 'Author not found' }, { status: 404 });

    const u = user as { companyPosition?: string };
    const reviewRow = reviewAgg[0] as { avg?: number; count?: number } | undefined;

    return NextResponse.json({
      author: {
        ...shaped,
        companyPosition: u.companyPosition,
        isVerifiedAccount: isPublicVerifiedAccount(user),
      },
      listings: listings.map((l) => ({
        _id: String((l as { _id: unknown })._id),
        slug: (l as { slug?: string }).slug,
        title: (l as { title: string }).title,
        price: (l as { price: number }).price,
        listingType: (l as { listingType: string }).listingType,
        rentPeriod: (l as { rentPeriod?: string }).rentPeriod,
        propertyType: (l as { propertyType: string }).propertyType,
        location: (l as { location?: { city?: string; state?: string } }).location,
        bedrooms: (l as { bedrooms: number }).bedrooms,
        bathrooms: (l as { bathrooms: number }).bathrooms,
        images: (l as { images?: { url: string }[] }).images,
        videos: (l as { videos?: { url: string }[] }).videos,
      })),
      totalListings,
      likeCount,
      reviewStats: {
        avgRating: reviewRow?.avg ? Math.round(reviewRow.avg * 10) / 10 : 0,
        totalReviews: reviewRow?.count ?? 0,
      },
    });
  } catch (e) {
    console.error('[authors]', e);
    return NextResponse.json({ error: 'Failed to load author' }, { status: 500 });
  }
}
