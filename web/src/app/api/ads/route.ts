import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import UserAd from '@/models/UserAd';
import AdConfig from '@/models/AdConfig';
import { USER_AD_STATUS } from '@/lib/constants';
import {
  adDurationMs,
  computeAdAmount,
  isValidAdPlacement,
  normalizeAdConfigForClient,
  normalizeAdPlacement,
  parseAdPricingMode,
  placementPricingValue,
  type PlacementPricingRates,
} from '@/lib/ad-placements';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    const [ads, adConfig] = await Promise.all([
      UserAd.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean(),
      AdConfig.findOne().lean(),
    ]);
    const normalized = normalizeAdConfigForClient(adConfig || { placementPricing: {}, adsense: {}, adsterra: {} });
    return NextResponse.json({
      ads: ads.map((a) => ({
        ...a,
        _id: (a as { _id: mongoose.Types.ObjectId })._id.toString(),
        userId: (a as { userId: mongoose.Types.ObjectId }).userId?.toString(),
      })),
      placementPricing: normalized.placementPricing,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch ads' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rawPlacement = body.placement as string | undefined;
    const media = body.media as { public_id?: string; url?: string; type?: string } | undefined;
    const startDateStr = body.startDate as string | undefined;
    const endDateStr = body.endDate as string | undefined;
    const durationHours = body.durationHours as number | undefined;
    const duration = typeof body.duration === 'number' ? body.duration : durationHours;
    const targetUrl = body.targetUrl as string | undefined;
    const useHourlyPricing = body.useHourlyPricing as boolean | undefined;
    const pricingMode = parseAdPricingMode(body.pricingMode, useHourlyPricing);

    if (!rawPlacement || !isValidAdPlacement(rawPlacement)) {
      return NextResponse.json({ error: 'Invalid placement' }, { status: 400 });
    }
    const placement = normalizeAdPlacement(rawPlacement);
    if (!media?.url || !media?.public_id || !['image', 'video'].includes(media.type || '')) {
      return NextResponse.json({ error: 'Valid media (url, public_id, type) required' }, { status: 400 });
    }
    if (!targetUrl || typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl)) {
      return NextResponse.json({ error: 'Valid targetUrl (redirect URL) required' }, { status: 400 });
    }

    let start: Date;
    let end: Date;
    if (duration != null && duration > 0) {
      start = startDateStr ? new Date(startDateStr) : new Date();
      end = new Date(start.getTime() + adDurationMs(pricingMode, duration));
    } else if (startDateStr && endDateStr) {
      start = new Date(startDateStr);
      end = new Date(endDateStr);
    } else {
      return NextResponse.json({ error: 'Provide startDate+endDate or startDate+duration' }, { status: 400 });
    }
    if (start >= end || start.getTime() < Date.now() - 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Invalid date range or start must be in the future' }, { status: 400 });
    }

    await dbConnect();

    const config = await AdConfig.findOne().lean();
    const pricingMap = config?.placementPricing as Record<string, PlacementPricingRates> | undefined;
    const pricing = placementPricingValue(pricingMap, placement);
    if (!pricing) {
      return NextResponse.json({ error: 'Pricing not configured for this placement' }, { status: 400 });
    }

    const amount = computeAdAmount(pricing, pricingMode, start, end);
    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    const overlap = await UserAd.findOne({
      placement,
      status: USER_AD_STATUS.APPROVED,
      $or: [{ startDate: { $lt: end }, endDate: { $gt: start } }],
    });
    if (overlap) {
      return NextResponse.json({
        error: 'This placement is already booked for the selected date/time. Choose different dates or placement.',
      }, { status: 409 });
    }

    const ad = await UserAd.create({
      userId: session.user.id,
      placement,
      media: { public_id: media.public_id, url: media.url, type: media.type as 'image' | 'video' },
      startDate: start,
      endDate: end,
      targetUrl: targetUrl.trim(),
      status: USER_AD_STATUS.PENDING_APPROVAL,
      amountPaid: amount,
    });

    return NextResponse.json({
      ad: {
        _id: ad._id.toString(),
        placement: ad.placement,
        media: ad.media,
        startDate: ad.startDate,
        endDate: ad.endDate,
        targetUrl: ad.targetUrl,
        status: ad.status,
        amount,
        currency: pricing.currency || 'NGN',
      },
      amount,
      currency: pricing.currency || 'NGN',
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create ad' }, { status: 500 });
  }
}
