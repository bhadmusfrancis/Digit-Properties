import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import Listing from '@/models/Listing';
import { LISTING_STATUS } from '@/lib/constants';

const PUBLIC_USER_SELECT = 'name image role companyPosition';

/** GET /api/authors/[id] — public profile and active listings for an author (listing creator). */
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
    const user = await User.findById(id).select(PUBLIC_USER_SELECT).lean();
    if (!user) return NextResponse.json({ error: 'Author not found' }, { status: 404 });

    const [listings, total] = await Promise.all([
      Listing.find({ createdBy: new mongoose.Types.ObjectId(id), status: LISTING_STATUS.ACTIVE })
        .sort({ createdAt: -1 })
        .limit(24)
        .select('title price listingType rentPeriod propertyType location bedrooms bathrooms images')
        .lean(),
      Listing.countDocuments({ createdBy: new mongoose.Types.ObjectId(id), status: LISTING_STATUS.ACTIVE }),
    ]);

    const author = {
      _id: (user as { _id: unknown })._id,
      name: (user as { name?: string }).name,
      image: (user as { image?: string }).image,
      role: (user as { role?: string }).role,
      companyPosition: (user as { companyPosition?: string }).companyPosition,
    };

    return NextResponse.json({
      author,
      listings: listings.map((l) => ({
        _id: (l as { _id: unknown })._id,
        title: (l as { title: string }).title,
        price: (l as { price: number }).price,
        listingType: (l as { listingType: string }).listingType,
        rentPeriod: (l as { rentPeriod?: string }).rentPeriod,
        propertyType: (l as { propertyType: string }).propertyType,
        location: (l as { location?: { city?: string; state?: string } }).location,
        bedrooms: (l as { bedrooms: number }).bedrooms,
        bathrooms: (l as { bathrooms: number }).bathrooms,
        images: (l as { images?: { url: string }[] }).images,
      })),
      totalListings: total,
    });
  } catch (e) {
    console.error('[authors]', e);
    return NextResponse.json({ error: 'Failed to load author' }, { status: 500 });
  }
}
