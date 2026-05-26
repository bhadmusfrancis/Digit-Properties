import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import SubscriptionConfig from '@/models/SubscriptionConfig';
import { BOOST_PACKAGES } from '@/lib/boost-packages';
import {
  LISTING_PACKAGE_TIERS,
  getListingPackageDefaultLimits,
  getListingPackageTierLabel,
} from '@/lib/listing-package-defaults';

export type PackageDisplay = {
  tier: string;
  label: string;
  priceMonthly: number;
  boostDays: number;
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  maxCategories: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  isStarter: boolean;
};

function buildPackagesFromConfigs(
  configs: {
    tier: string;
    maxListings?: number;
    maxImages?: number;
    maxVideos?: number;
    maxCategories?: number;
    canFeatured?: boolean;
    canHighlighted?: boolean;
    priceMonthly?: number;
  }[]
): PackageDisplay[] {
  return LISTING_PACKAGE_TIERS.map((tier) => {
    const found = configs.find((c) => c.tier === tier);
    const def = getListingPackageDefaultLimits(tier);
    const pkg = BOOST_PACKAGES[tier];
    return {
      tier,
      label: getListingPackageTierLabel(tier),
      priceMonthly: found?.priceMonthly ?? def.priceMonthly,
      boostDays: pkg.days,
      maxListings: found?.maxListings ?? def.maxListings,
      maxImages: found?.maxImages ?? def.maxImages,
      maxVideos: found?.maxVideos ?? def.maxVideos,
      maxCategories: found?.maxCategories ?? def.maxCategories,
      canFeatured: found?.canFeatured ?? def.canFeatured,
      canHighlighted: found?.canHighlighted ?? def.canHighlighted,
      isStarter: tier === 'starter',
    };
  });
}

/** Public: listing boost packages (Starter, Pro, Premium) for plans / new listing pages. */
export async function GET() {
  try {
    await dbConnect();
    const configs = await SubscriptionConfig.find({
      tier: { $in: [...LISTING_PACKAGE_TIERS] },
    })
      .sort({ tier: 1 })
      .lean();
    return NextResponse.json(buildPackagesFromConfigs(configs));
  } catch (e) {
    console.error('[packages]', e);
    return NextResponse.json(buildPackagesFromConfigs([]));
  }
}
