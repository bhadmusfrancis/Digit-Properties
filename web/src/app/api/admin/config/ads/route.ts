import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import AdConfig from '@/models/AdConfig';
import { USER_ROLES, AD_PLACEMENTS } from '@/lib/constants';
import { normalizeAdConfigForClient } from '@/lib/ad-placements';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await dbConnect();
    let config = await AdConfig.findOne().lean();
    if (!config) {
      await AdConfig.create({});
      config = await AdConfig.findOne().lean();
    }
    return NextResponse.json(
      normalizeAdConfigForClient(config || { placementPricing: {}, adsense: {}, adsterra: {} })
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load ad config' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const { placementPricing, adsense, adsterra } = body as {
      placementPricing?: Record<
        string,
        { pricePerDay: number; pricePerHour: number; pricePerWeek?: number; pricePerMonth?: number; currency?: string }
      >;
      adsense?: Record<string, string>;
      adsterra?: Record<string, string>;
    };
    await dbConnect();
    let config = await AdConfig.findOne().lean();
    if (!config) {
      await AdConfig.create({});
      config = await AdConfig.findOne().lean();
    }
    if (!config) {
      return NextResponse.json({ error: 'Failed to save ad config' }, { status: 500 });
    }

    type PricingRates = {
      pricePerDay: number;
      pricePerHour: number;
      pricePerWeek: number;
      pricePerMonth: number;
      currency: string;
    };
    const toFiniteNumber = (value: unknown): number | null => {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const currentPricing =
      config.placementPricing && typeof config.placementPricing === 'object'
        ? (config.placementPricing as Record<string, PricingRates>)
        : {};
    const nextPricing: Record<string, PricingRates> = { ...currentPricing };

    if (placementPricing && typeof placementPricing === 'object') {
      for (const p of AD_PLACEMENTS) {
        const v = placementPricing[p];
        if (!v || typeof v !== 'object') continue;
        const day = toFiniteNumber(v.pricePerDay);
        const hour = toFiniteNumber(v.pricePerHour);
        if (day === null || hour === null) continue;
        const week = toFiniteNumber(v.pricePerWeek);
        const month = toFiniteNumber(v.pricePerMonth);
        nextPricing[p] = {
          pricePerDay: day,
          pricePerHour: hour,
          pricePerWeek: week === null ? day * 7 : week,
          pricePerMonth: month === null ? day * 30 : month,
          currency: typeof v.currency === 'string' && v.currency.trim() ? v.currency : 'NGN',
        };
      }
    }

    const update: Record<string, unknown> = { placementPricing: nextPricing };
    if (adsense && typeof adsense === 'object') update.adsense = adsense;
    if (adsterra && typeof adsterra === 'object') update.adsterra = adsterra;

    // Mixed nested fields are not change-tracked by Mongoose; $set persists the whole object.
    const saved = await AdConfig.findByIdAndUpdate(config._id, { $set: update }, { new: true }).lean();
    return NextResponse.json(
      normalizeAdConfigForClient(saved || { placementPricing: nextPricing, adsense: adsense || {}, adsterra: adsterra || {} })
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to save ad config' }, { status: 500 });
  }
}
