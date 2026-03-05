import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import AdConfig from '@/models/AdConfig';
import { USER_ROLES, AD_PLACEMENTS } from '@/lib/constants';

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
    return NextResponse.json(config || { placementPricing: {}, adsense: {} });
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
    const { placementPricing, adsense } = body as {
      placementPricing?: Record<string, { pricePerDay: number; pricePerHour: number; currency?: string }>;
      adsense?: Record<string, string>;
    };
    await dbConnect();
    let config = await AdConfig.findOne();
    if (!config) config = await AdConfig.create({});
    if (placementPricing && typeof placementPricing === 'object') {
      for (const p of AD_PLACEMENTS) {
        const v = placementPricing[p];
        if (v && typeof v.pricePerDay === 'number' && typeof v.pricePerHour === 'number') {
          if (!config.placementPricing) config.placementPricing = {} as Record<string, { pricePerDay: number; pricePerHour: number; currency: string }>;
          (config.placementPricing as Record<string, { pricePerDay: number; pricePerHour: number; currency: string }>)[p] = {
            pricePerDay: v.pricePerDay,
            pricePerHour: v.pricePerHour,
            currency: v.currency || 'NGN',
          };
        }
      }
    }
    if (adsense && typeof adsense === 'object') {
      config.adsense = adsense;
    }
    await config.save();
    return NextResponse.json(await AdConfig.findOne().lean());
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to save ad config' }, { status: 500 });
  }
}
