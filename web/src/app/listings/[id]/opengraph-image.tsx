import { ImageResponse } from 'next/og';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { canViewListingOnSite } from '@/lib/listing-access';
import { formatListingTypeLabel } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';
import { formatListingLocationDisplay } from '@/lib/listing-location';
import { OgBrandedFrame, OG_IMAGE_SIZE } from '@/lib/og-image-template';

export const alt = 'Property listing preview';
export const size = OG_IMAGE_SIZE;
export const contentType = 'image/png';

const MAX_TITLE_LEN = 72;

function truncateTitle(t: string) {
  const s = t.trim();
  if (s.length <= MAX_TITLE_LEN) return s;
  return `${s.slice(0, MAX_TITLE_LEN - 1)}…`;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return new ImageResponse(
      <OgBrandedFrame title="Property listing" subtitle="digitproperties.com" kicker="Digit Properties" />,
      OG_IMAGE_SIZE,
    );
  }

  await dbConnect();
  const listing = await Listing.findById(id)
    .select('title status createdBy price listingType rentPeriod location')
    .lean();

  if (!listing || !canViewListingOnSite({ status: listing.status, createdBy: listing.createdBy, session: null })) {
    return new ImageResponse(
      <OgBrandedFrame title="Property listing" subtitle="digitproperties.com" kicker="Digit Properties" />,
      OG_IMAGE_SIZE,
    );
  }

  const doc = listing as {
    title?: string;
    price?: number;
    listingType?: string;
    rentPeriod?: string;
    location?: Parameters<typeof formatListingLocationDisplay>[0];
  };

  const priceLine =
    typeof doc.price === 'number'
      ? formatPrice(doc.price, doc.rentPeriod as 'day' | 'month' | 'year' | undefined)
      : '';
  const typeLine = doc.listingType ? formatListingTypeLabel(doc.listingType) : '';
  const loc = formatListingLocationDisplay(doc.location);
  const subtitle = [priceLine, typeLine, loc].filter(Boolean).join(' · ') || 'View on Digit Properties';

  return new ImageResponse(
    <OgBrandedFrame title={truncateTitle(doc.title || 'Listing')} subtitle={subtitle} kicker="Property listing" />,
    OG_IMAGE_SIZE,
  );
}
