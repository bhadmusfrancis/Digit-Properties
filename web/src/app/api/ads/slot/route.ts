import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import UserAd from '@/models/UserAd';
import AdConfig from '@/models/AdConfig';
import { LISTING_STATUS, AD_PLACEMENTS, USER_AD_STATUS } from '@/lib/constants';
import { shapePublicCreatedBy, USER_PUBLIC_BADGE_FIELDS } from '@/lib/verification';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const placement = searchParams.get('placement') || 'home_featured';
    if (!(AD_PLACEMENTS as readonly string[]).includes(placement)) {
      return NextResponse.json({ error: 'Invalid placement' }, { status: 400 });
    }

    await dbConnect();
    const now = new Date();
    const pool: Array<
      | { type: 'listing'; listing: unknown }
      | { type: 'ad'; ad: unknown }
      | { type: 'adsense'; code: string }
    > = [];

    if (placement === 'home_featured') {
      const listings = await Listing.find({
        status: LISTING_STATUS.ACTIVE,
        $or: [{ featured: true }, { highlighted: true }],
      })
        .sort({ 'images.0.url': -1, createdAt: -1 })
        .limit(20)
        .select('title description price listingType rentPeriod propertyType location bedrooms bathrooms toilets area amenities images videos createdBy')
        .populate('createdBy', USER_PUBLIC_BADGE_FIELDS)
        .lean();
      for (const l of listings) {
        const row = l as { _id: mongoose.Types.ObjectId; createdBy?: unknown; [k: string]: unknown };
        const { createdBy: cb, ...rest } = row;
        pool.push({
          type: 'listing',
          listing: { ...rest, _id: row._id.toString(), createdBy: shapePublicCreatedBy(cb) ?? cb },
        });
      }
    }

    const activeAds = await UserAd.find({
      placement,
      status: USER_AD_STATUS.APPROVED,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .limit(10)
      .lean();
    for (const ad of activeAds) {
      const row = ad as { _id: mongoose.Types.ObjectId; media: { url: string; type: string }; targetUrl: string };
      pool.push({
        type: 'ad',
        ad: { _id: row._id.toString(), media: row.media, targetUrl: row.targetUrl },
      });
    }

    const config = await AdConfig.findOne().lean();
    const adsense = config?.adsense as Record<string, string> | undefined;
    const adsenseCode = adsense?.[placement];
    if (adsenseCode && typeof adsenseCode === 'string' && adsenseCode.trim()) {
      pool.push({ type: 'adsense', code: adsenseCode });
    }

    if (pool.length === 0) {
      return NextResponse.json({ type: null, listing: null, ad: null, adsenseCode: null });
    }

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (chosen.type === 'listing') {
      return NextResponse.json({ type: 'listing', listing: chosen.listing, ad: null, adsenseCode: null });
    }
    if (chosen.type === 'ad') {
      return NextResponse.json({ type: 'ad', listing: null, ad: chosen.ad, adsenseCode: null });
    }
    return NextResponse.json({ type: 'adsense', listing: null, ad: null, adsenseCode: chosen.code });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load slot' }, { status: 500 });
  }
}
