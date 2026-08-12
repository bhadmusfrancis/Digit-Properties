import { positiveCount, type TitleInput } from '@/lib/listing-title';
import { formatPrice } from '@/lib/utils';
import { formatListingTypeLabel } from '@/lib/constants';
import { formatPropertyTypeLabel } from '@/lib/constants';
import { escapeHtml } from '@/lib/utils';

export type DescriptionInput = TitleInput & {
  propertyTypes?: string[];
  rentPeriod?: 'day' | 'month' | 'year';
  /** Asking price (NGN); required for correct copy—omit only if truly unknown. */
  price?: number;
  /** Plain-text location line (address or city, state). */
  locationLine: string;
};

function typesLabel(input: DescriptionInput): string {
  const types =
    input.propertyTypes?.length && input.propertyTypes.length > 0
      ? input.propertyTypes
      : input.propertyType
        ? [input.propertyType]
        : [];
  if (!types.length) return 'Property';
  return types.map((t) => formatPropertyTypeLabel(t)).join(' · ');
}

function formatAskingPriceLine(input: DescriptionInput): string {
  const p = input.price;
  const valid = typeof p === 'number' && Number.isFinite(p) && p > 0;
  if (!valid) return 'Price on request — please enquire for the latest figure.';
  return formatPrice(p, input.listingType === 'rent' ? input.rentPeriod : undefined);
}

/** Builds a professional HTML description from structured property fields (always derive from `input`; no caching). */
export function generateListingDescriptionHtml(input: DescriptionInput): string {
  const typeStr = typesLabel(input);
  const listingLabel = formatListingTypeLabel(input.listingType || 'sale');
  const priceLine = formatAskingPriceLine(input);
  const loc = escapeHtml((input.locationLine || '').trim() || 'Nigeria');

  const parts: string[] = [];

  const overviewHooks = [
    `Presenting a <strong>${escapeHtml(typeStr)}</strong> ${escapeHtml(
      input.listingType === 'joint_venture' ? 'opportunity' : 'property'
    )} ${escapeHtml(listingLabel === 'Rent' ? 'for rent' : listingLabel === 'Joint venture' ? 'for joint venture' : 'for sale')} in <strong>${loc}</strong>. Suited for serious buyers and tenants who value clear information and location context.`,
    `We are pleased to highlight a <strong>${escapeHtml(typeStr)}</strong> ${escapeHtml(
      input.listingType === 'joint_venture' ? 'opportunity' : 'property'
    )} ${escapeHtml(listingLabel === 'Rent' ? 'for rent' : listingLabel === 'Joint venture' ? 'for joint venture' : 'for sale')} in <strong>${loc}</strong>, presented with transparent key details below.`,
    `Explore a <strong>${escapeHtml(typeStr)}</strong> ${escapeHtml(
      input.listingType === 'joint_venture' ? 'opportunity' : 'property'
    )} ${escapeHtml(listingLabel === 'Rent' ? 'available for rent' : listingLabel === 'Joint venture' ? 'open to joint venture' : 'available for sale')} in <strong>${loc}</strong> — ideal if you want facts up front before an inspection.`,
  ];
  const overviewBody = overviewHooks[Math.floor(Math.random() * overviewHooks.length)];

  parts.push(`<p>${overviewBody}</p>`);

  parts.push(`<p><strong>Asking price</strong></p><p>${escapeHtml(priceLine)}</p>`);

  const detailBits: string[] = [];
  const beds = positiveCount(input.bedrooms);
  const baths = positiveCount(input.bathrooms);
  const toilets = positiveCount(input.toilets);
  const area = positiveCount(input.area);
  if (beds > 0) detailBits.push(`${beds} bedroom(s)`);
  if (baths > 0) detailBits.push(`${baths} bathroom(s)`);
  if (toilets > 0) detailBits.push(`${toilets} toilet(s)`);
  if (area > 0) detailBits.push(`${area} sqm`);

  if (detailBits.length) {
    parts.push(`<p><strong>Property details</strong></p><p>${escapeHtml(detailBits.join(' · '))}.</p>`);
  }

  const amenities = (input.amenities ?? []).map((a) => a.trim()).filter(Boolean);
  if (amenities.length) {
    parts.push(`<p><strong>Features &amp; amenities</strong></p><ul>`);
    for (const a of amenities.slice(0, 24)) {
      parts.push(`<li>${escapeHtml(a)}</li>`);
    }
    parts.push(`</ul>`);
  }

  const locationClosers = [
    `We suggest confirming access roads, parking, and neighbourhood fit on a site visit.`,
    `A physical viewing will clarify access, security, and day-to-day convenience in the area.`,
    `Please plan an inspection to validate routes in and suitability for your routine.`,
    `Use an on-site visit to double-check directions, parking, and the immediate surroundings.`,
    `Local traffic patterns and neighbourhood character are best judged during a walk-through.`,
  ];
  const closer = locationClosers[Math.floor(Math.random() * locationClosers.length)];

  parts.push(`<p><strong>Location</strong></p><p>Situated in <strong>${loc}</strong>. ${escapeHtml(closer)}</p>`);

  return parts.join('\n');
}
