import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import SubscriptionConfig from '@/models/SubscriptionConfig';
import { USER_ROLES } from '@/lib/constants';
import { BOOST_PACKAGES } from '@/lib/boost-packages';
import {
  LISTING_PACKAGE_TIERS,
  getListingPackageDefaultLimits,
  getListingPackageTierLabel,
  type ListingPackageTier,
} from '@/lib/listing-package-defaults';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await dbConnect();
    const configs = await SubscriptionConfig.find({}).sort({ tier: 1 }).lean();
    const result = LISTING_PACKAGE_TIERS.map((tier) => {
      const found = configs.find((c) => c.tier === tier);
      const def = getListingPackageDefaultLimits(tier);
      const pkg = BOOST_PACKAGES[tier];
      return {
        tier,
        label: getListingPackageTierLabel(tier),
        boostDays: pkg.days,
        maxListings: found?.maxListings ?? def.maxListings,
        maxImages: found?.maxImages ?? def.maxImages,
        maxVideos: found?.maxVideos ?? def.maxVideos,
        canFeatured: found?.canFeatured ?? def.canFeatured,
        canHighlighted: found?.canHighlighted ?? def.canHighlighted,
        maxCategories: found?.maxCategories ?? def.maxCategories,
        priceMonthly: found?.priceMonthly ?? def.priceMonthly,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const { tier, maxListings, maxImages, maxVideos, canFeatured, canHighlighted, maxCategories, priceMonthly } = body;
    if (!tier || !LISTING_PACKAGE_TIERS.includes(tier as ListingPackageTier)) {
      return NextResponse.json({ error: 'Invalid tier. Use starter, pro, or premium.' }, { status: 400 });
    }
    const packageTier = tier as ListingPackageTier;
    await dbConnect();
    const def = getListingPackageDefaultLimits(packageTier);
    await SubscriptionConfig.findOneAndUpdate(
      { tier: packageTier },
      {
        maxListings: Number(maxListings) ?? def.maxListings,
        maxImages: Number(maxImages) ?? def.maxImages,
        maxVideos: Number(maxVideos) ?? def.maxVideos,
        canFeatured: Boolean(canFeatured),
        canHighlighted: Boolean(canHighlighted),
        maxCategories: Number(maxCategories) >= 1 ? Number(maxCategories) : def.maxCategories,
        priceMonthly: Number(priceMonthly) >= 0 ? Number(priceMonthly) : def.priceMonthly,
      },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
