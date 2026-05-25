import { LISTING_TYPE } from '@/lib/constants';
import { assessNigeriaLocation, type LocationLike } from '@/lib/nigeria-location';
import { stripHtml } from '@/lib/utils';

export type ListingSuspicionInput = {
  title: string;
  description: string;
  listingType: string;
  propertyType: string;
  propertyTypes?: string[];
  price: number;
  rentPeriod?: string;
  location: LocationLike;
  bedrooms: number;
  bathrooms: number;
  toilets?: number;
  tags?: string[];
  amenities?: string[];
};

/** Terms that strongly suggest non–real-estate spam or scams. */
const OFF_TOPIC_KEYWORDS = [
  'bitcoin',
  'crypto',
  'cryptocurrency',
  'forex',
  'binary option',
  'mlm',
  'pyramid scheme',
  'get rich quick',
  'work from home earn',
  'viagra',
  'cialis',
  'escort',
  'hookup',
  'dating site',
  'lottery',
  'casino',
  'betting tips',
  'free iphone',
  'whatsapp group link',
  'telegram channel',
  'click this link',
  'limited offer act now',
  'wire transfer fee',
  'western union',
  'gift card',
  'pay before viewing',
  'inheritance fund',
  'prince',
  'loan without collateral',
  'quick loan',
  'credit card dump',
  'hacking service',
  'fake document',
  'passport for sale',
  'used car',
  'vehicle for sale',
  'laptop for sale',
  'phone for sale',
  'fashion boutique',
  'restaurant menu',
  'catering service only',
  'job vacancy',
  'cv writing',
  'scholarship abroad',
];

/** Weak signal: listing text lacks any property/real-estate context. */
const REAL_ESTATE_HINTS = [
  'apartment',
  'flat',
  'house',
  'bungalow',
  'duplex',
  'terrace',
  'villa',
  'land',
  'plot',
  'acre',
  'hectare',
  'commercial',
  'office',
  'shop',
  'warehouse',
  'rent',
  'lease',
  'sale',
  'sell',
  'buy',
  'bedroom',
  'bathroom',
  'toilet',
  'sqm',
  'square meter',
  'property',
  'real estate',
  'estate',
  'development',
  'c of o',
  'survey',
  'title document',
  'tenancy',
  'serviced',
  'furnished',
  'unfurnished',
  'joint venture',
  'jv',
  'lagos',
  'abuja',
  'lekki',
  'ikeja',
  'portharcourt',
  'port harcourt',
];

const MAX_BEDROOMS = 30;
const MAX_BATHROOMS = 30;
const MAX_TOILETS = 40;

const PRICE_MAX: Record<string, number> = {
  sale: 15_000_000_000,
  rent_day: 50_000_000,
  rent_month: 800_000_000,
  rent_year: 8_000_000_000,
  joint_venture: 200_000_000_000,
};

const PRICE_MIN: Record<string, number> = {
  sale: 25_000,
  sale_land: 5_000,
  rent_day: 500,
  rent_month: 2_500,
  rent_year: 25_000,
  joint_venture: 100_000,
};

function combinedText(input: ListingSuspicionInput): string {
  const desc = stripHtml(input.description || '');
  const tags = [...(input.tags ?? []), ...(input.amenities ?? [])].join(' ');
  return normalize(`${input.title} ${desc} ${tags}`);
}

function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function hasOffTopicContent(text: string): boolean {
  return OFF_TOPIC_KEYWORDS.some((kw) => text.includes(kw));
}

function lacksRealEstateContext(text: string): boolean {
  if (!text || text.length < 15) return false;
  return !REAL_ESTATE_HINTS.some((h) => text.includes(h));
}

function priceBoundsKey(input: ListingSuspicionInput): string {
  if (input.listingType === LISTING_TYPE.JOINT_VENTURE) return 'joint_venture';
  if (input.listingType === LISTING_TYPE.RENT) {
    const period = input.rentPeriod || 'month';
    if (period === 'day') return 'rent_day';
    if (period === 'year') return 'rent_year';
    return 'rent_month';
  }
  const types = input.propertyTypes?.length ? input.propertyTypes : [input.propertyType];
  if (types.includes('land')) return 'sale_land';
  return 'sale';
}

function checkUnrealisticPrice(input: ListingSuspicionInput): string | null {
  const price = input.price;
  if (!Number.isFinite(price) || price <= 0) return 'Invalid price';

  const key = priceBoundsKey(input);
  const max =
    key === 'joint_venture'
      ? PRICE_MAX.joint_venture
      : key.startsWith('rent')
        ? (PRICE_MAX[key as keyof typeof PRICE_MAX] ?? PRICE_MAX.rent_month)
        : PRICE_MAX.sale;
  const min = PRICE_MIN[key as keyof typeof PRICE_MIN] ?? PRICE_MIN.sale;

  if (price < min) {
    return `Price (${formatNgn(price)}) is unusually low for this listing type`;
  }
  if (price > max) {
    return `Price (${formatNgn(price)}) is unusually high for this listing type`;
  }
  return null;
}

function formatNgn(n: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

function checkRoomCounts(input: ListingSuspicionInput): string[] {
  const reasons: string[] = [];
  const types = input.propertyTypes?.length ? input.propertyTypes : [input.propertyType];
  const isLand = types.every((t) => t === 'land');

  if (input.bedrooms > MAX_BEDROOMS) {
    reasons.push(`Bedroom count (${input.bedrooms}) looks unrealistic`);
  }
  if (input.bathrooms > MAX_BATHROOMS) {
    reasons.push(`Bathroom count (${input.bathrooms}) looks unrealistic`);
  }
  if ((input.toilets ?? 0) > MAX_TOILETS) {
    reasons.push(`Toilet count (${input.toilets}) looks unrealistic`);
  }

  if (isLand) {
    if (input.bedrooms > 2 || input.bathrooms > 2) {
      reasons.push('Land listings should not list many bedrooms or bathrooms');
    }
  }

  const isStudio = types.includes('studio') || types.includes('mini_flat');
  if (isStudio && input.bedrooms > 3) {
    reasons.push('Studio/mini-flat listings rarely have more than 3 bedrooms');
  }

  return reasons;
}

/**
 * Returns human-readable reasons when a listing looks suspicious.
 * Empty array = passes automated checks.
 */
export function detectListingSuspicion(input: ListingSuspicionInput): string[] {
  const reasons: string[] = [];
  const text = combinedText(input);

  if (hasOffTopicContent(text)) {
    reasons.push('Content may not be related to real estate');
  } else if (lacksRealEstateContext(text) && text.length > 40) {
    reasons.push('Description does not appear to describe a property listing');
  }

  const priceReason = checkUnrealisticPrice(input);
  if (priceReason) reasons.push(priceReason);

  reasons.push(...checkRoomCounts(input));

  const locCheck = assessNigeriaLocation(input.location);
  if (!locCheck.inNigeria && locCheck.reason) {
    reasons.push(locCheck.reason);
  }

  return [...new Set(reasons)];
}

export function isListingSuspicious(input: ListingSuspicionInput): boolean {
  return detectListingSuspicion(input).length > 0;
}
