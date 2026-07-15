import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import UserAd from '@/models/UserAd';
import AdConfig from '@/models/AdConfig';
import { LISTING_STATUS, USER_AD_STATUS } from '@/lib/constants';
import {
  isValidAdPlacement,
  normalizeAdPlacement,
  placementConfigValue,
  userAdPlacementsForSlot,
} from '@/lib/ad-placements';
import { shapePublicCreatedBy, USER_PUBLIC_BADGE_FIELDS } from '@/lib/verification';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const placement = normalizeAdPlacement(searchParams.get('placement') || 'home_featured');
    if (!isValidAdPlacement(placement)) {
      return NextResponse.json({ error: 'Invalid placement' }, { status: 400 });
    }

    await dbConnect();
    const now = new Date();
    type SlotItem =
      | { type: 'listing'; listing: unknown }
      | { type: 'ad'; ad: unknown }
      | { type: 'adsense'; code: string }
      | { type: 'adsterra'; code: string };

    /** Content (featured listings + paid user ads). */
    const contentPool: SlotItem[] = [];
    /** Network ads — kept separate so ~20 listings cannot drown out AdSense. */
    const networkPool: SlotItem[] = [];

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
        contentPool.push({
          type: 'listing',
          listing: { ...rest, _id: row._id.toString(), createdBy: shapePublicCreatedBy(cb) ?? cb },
        });
      }
    }

    const activeAds = await UserAd.find({
      placement: userAdPlacementsForSlot(placement),
      status: USER_AD_STATUS.APPROVED,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .limit(10)
      .lean();
    const adsenseReviewMode = process.env.ADSENSE_REVIEW_MODE === 'true';
    if (!adsenseReviewMode) {
      for (const ad of activeAds) {
        const row = ad as { _id: mongoose.Types.ObjectId; media: { url: string; type: string }; targetUrl: string };
        contentPool.push({
          type: 'ad',
          ad: { _id: row._id.toString(), media: row.media, targetUrl: row.targetUrl },
        });
      }
    }

    const config = await AdConfig.findOne().lean();
    const adsense = config?.adsense as Record<string, string> | undefined;
    const adsenseCode = placementConfigValue(adsense, placement);
    if (adsenseCode) {
      networkPool.push({ type: 'adsense', code: adsenseCode });
    }

    const adsterra = config?.adsterra as Record<string, string> | undefined;
    const adsterraCode = placementConfigValue(adsterra, placement);
    if (adsterraCode && !adsenseReviewMode) {
      networkPool.push({ type: 'adsterra', code: adsterraCode });
    }

    if (contentPool.length === 0 && networkPool.length === 0) {
      return NextResponse.json({ type: null, listing: null, ad: null, adsenseCode: null, adsterraCode: null });
    }

    // When network ads are configured, pick that group first (70%) so Featured slots
    // show AdSense/Adsterra instead of almost always a random featured listing.
    let pickPool: SlotItem[];
    if (networkPool.length && contentPool.length) {
      pickPool = Math.random() < 0.7 ? networkPool : contentPool;
    } else {
      pickPool = networkPool.length ? networkPool : contentPool;
    }

    const chosen = pickPool[Math.floor(Math.random() * pickPool.length)]!;
    if (chosen.type === 'listing') {
      return NextResponse.json({ type: 'listing', listing: chosen.listing, ad: null, adsenseCode: null, adsterraCode: null });
    }
    if (chosen.type === 'ad') {
      return NextResponse.json({ type: 'ad', listing: null, ad: chosen.ad, adsenseCode: null, adsterraCode: null });
    }
    if (chosen.type === 'adsterra') {
      return NextResponse.json({ type: 'adsterra', listing: null, ad: null, adsenseCode: null, adsterraCode: chosen.code });
    }
    return NextResponse.json({ type: 'adsense', listing: null, ad: null, adsenseCode: chosen.code, adsterraCode: null });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load slot' }, { status: 500 });
  }
}
