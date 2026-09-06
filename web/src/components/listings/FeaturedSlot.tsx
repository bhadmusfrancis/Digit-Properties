'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { formatPrice } from '@/lib/utils';
import { formatListingLocationDisplay } from '@/lib/listing-location';
import { getListingDisplayImage, listingHasVideoMedia } from '@/lib/listing-default-image';
import { listingImageProps } from '@/lib/next-image';
import { AD_PLACEMENTS, formatListingTypeLabel, formatPropertyTypesLine } from '@/lib/constants';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { getListingPublicPath } from '@/lib/listing-path';
import { HtmlAdEmbed } from '@/components/listings/HtmlAdEmbed';
import { SponsoredLabel } from '@/components/ui/SponsoredLabel';

type ListingPayload = {
  _id: string;
  slug?: string;
  title: string;
  description?: string;
  price: number;
  listingType: string;
  rentPeriod?: 'day' | 'month' | 'year';
  propertyType: string;
  propertyTypes?: string[];
  location?: { address?: string; city?: string; state?: string; suburb?: string };
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  area?: number;
  amenities?: string[];
  images?: { url: string }[];
  videos?: { url: string; public_id?: string }[];
  createdBy?: { name?: string; role?: string; isVerifiedAccount?: boolean };
};

type AdPayload = {
  _id: string;
  media: { url: string; type: string };
  targetUrl: string;
};

type SlotResponse = {
  type: 'listing' | 'ad' | 'adsense' | 'adsterra' | null;
  listing: ListingPayload | null;
  ad: AdPayload | null;
  adsenseCode: string | null;
  adsterraCode: string | null;
};

type Placement = (typeof AD_PLACEMENTS)[number];

async function fetchSlot(placement: Placement): Promise<SlotResponse> {
  const res = await fetch(`/api/ads/slot?placement=${placement}&_t=${Date.now()}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || res.statusText || 'Failed to fetch');
  return data as SlotResponse;
}

type FeaturedSlotProps = {
  placement?: Placement;
  hideWhenEmpty?: boolean;
  /** Extra classes on the outer wrapper (default includes mt-6). */
  className?: string;
  /**
   * `banner` = wide horizontal card (homepage).
   * `card` = stacked image-on-top card for narrow sidebars (trends detail).
   */
  layout?: 'banner' | 'card';
};

function slotWrap(className: string | undefined, children: ReactNode) {
  return <div className={className ?? 'mt-6'}>{children}</div>;
}

export function FeaturedSlot({
  placement = 'home_featured',
  hideWhenEmpty = false,
  className,
  layout = 'banner',
}: FeaturedSlotProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ads', 'slot', placement],
    queryFn: () => fetchSlot(placement),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (isLoading) {
    if (hideWhenEmpty) return null;
    if (layout === 'card') {
      return slotWrap(
        className,
        <div className="card w-full max-w-sm animate-pulse overflow-hidden">
          <div className="aspect-[16/10] w-full bg-gray-200" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-4/5 rounded bg-gray-200" />
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="h-3 w-2/3 rounded bg-gray-200" />
          </div>
        </div>
      );
    }
    return slotWrap(
      className,
      <div className="card w-full animate-pulse overflow-hidden md:flex">
        <div className="aspect-[4/3] w-full bg-gray-200 md:min-h-[280px] md:w-[42%] lg:min-h-[320px]" />
        <div className="flex flex-1 flex-col justify-center space-y-3 p-4 md:p-6">
          <div className="h-6 w-4/5 rounded bg-gray-200 md:h-7" />
          <div className="h-5 w-1/3 rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-200" />
          <div className="mt-2 flex gap-4">
            <div className="h-4 w-16 rounded bg-gray-200" />
            <div className="h-4 w-16 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    if (hideWhenEmpty) return null;
    return (
      <div className={`${className ?? 'mt-6'} rounded-xl border-2 border-dashed border-red-200 bg-red-50 py-12 text-center`}>
        <p className="text-red-600">Failed to load featured: {(error as Error)?.message}</p>
      </div>
    );
  }

  if (!data?.type) {
    if (hideWhenEmpty) return null;
    return (
      <div className={`${className ?? 'mt-6'} rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center`}>
        <p className="text-gray-500">No featured content right now.</p>
        <Link href="/listings" className="mt-4 inline-block text-primary-600 font-medium hover:underline">
          Browse listings
        </Link>
      </div>
    );
  }

  if (data.type === 'listing' && data.listing) {
    const listing = data.listing;
    const descriptionText = typeof listing.description === 'string'
      ? listing.description.replace(/<[^>]+>/g, '').trim().slice(0, 200)
      : '';
    const locationLine = formatListingLocationDisplay(listing.location);
    const typeBadge = (
      <>
        {formatListingTypeLabel(listing.listingType)}
        {listing.listingType === 'rent' && listing.rentPeriod && (
          <span className="ml-1 text-primary-600">/ {listing.rentPeriod}</span>
        )}
      </>
    );

    if (layout === 'card') {
      return slotWrap(
        className,
        <Link
          href={getListingPublicPath(listing)}
          className="card group block w-full max-w-sm overflow-hidden transition hover:shadow-lg"
        >
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-200">
            <Image
              {...listingImageProps(
                getListingDisplayImage(listing.images, listing.propertyType, listing.videos),
                480
              )}
              alt={listing.title}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              sizes="(max-width: 1024px) 100vw, 300px"
            />
            {listingHasVideoMedia(listing.images, listing.videos) && (
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-white">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
                Video
              </span>
            )}
            <span className="absolute left-2 top-2 rounded bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow-sm">
              {typeBadge}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 p-3.5">
            <p className="text-[15px] font-semibold leading-snug text-gray-900 line-clamp-2">{listing.title}</p>
            <p className="text-base font-bold text-primary-600">
              {formatPrice(listing.price, listing.listingType === 'rent' ? listing.rentPeriod : undefined)}
            </p>
            {locationLine ? <p className="text-xs text-gray-500 line-clamp-1">{locationLine}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
              {listing.bedrooms != null && listing.bedrooms > 0 && <span>{listing.bedrooms} beds</span>}
              {listing.bathrooms != null && listing.bathrooms > 0 && <span>{listing.bathrooms} baths</span>}
              {listing.area != null && listing.area > 0 && <span>{listing.area} sqm</span>}
              {(listing.propertyTypes?.length || listing.propertyType) && (
                <span className="line-clamp-1">{formatPropertyTypesLine(listing.propertyTypes, listing.propertyType)}</span>
              )}
            </div>
            <span className="mt-2 inline-flex w-fit rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition group-hover:bg-primary-700">
              View property →
            </span>
          </div>
        </Link>
      );
    }

    return slotWrap(
      className,
      <Link
          href={getListingPublicPath(listing)}
          className="card group block w-full overflow-hidden transition hover:shadow-xl md:flex md:flex-row"
        >
          <div className="relative w-full shrink-0 overflow-hidden bg-gray-200 md:min-h-[280px] md:w-[42%] lg:min-h-[320px] lg:max-w-[540px]">
            <div className="aspect-[4/3] w-full md:absolute md:inset-0 md:aspect-auto md:h-full">
              <Image
                {...listingImageProps(
                  getListingDisplayImage(listing.images, listing.propertyType, listing.videos),
                  520
                )}
                alt={listing.title}
                fill
                className="object-cover transition duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 520px"
              />
            </div>
            {listingHasVideoMedia(listing.images, listing.videos) && (
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-xs font-medium text-white">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
                Video
              </span>
            )}
            <span className="absolute right-2 top-2 rounded bg-white/95 px-2.5 py-1 text-xs font-semibold text-gray-800 shadow-sm">
              {typeBadge}
            </span>
          </div>
          <div className="flex flex-1 flex-col p-4 md:justify-center md:p-6 lg:p-8">
            <p className="text-lg font-semibold text-gray-900 line-clamp-2 md:text-xl md:line-clamp-none">
              {listing.title}
            </p>
            <p className="mt-1 text-lg font-bold text-primary-600 md:text-xl">
              {formatPrice(listing.price, listing.listingType === 'rent' ? listing.rentPeriod : undefined)}
            </p>
            {locationLine && (
              <p className="mt-1 text-sm text-gray-500 md:mt-2 md:text-base">
                {locationLine}
              </p>
            )}
            {descriptionText && (
              <p className="mt-2 hidden line-clamp-2 text-sm text-gray-600 md:block">
                {descriptionText}
                {listing.description && listing.description.length > 200 ? '…' : ''}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 md:mt-4 md:gap-x-6 md:text-base">
              {listing.bedrooms != null && <span>{listing.bedrooms} beds</span>}
              {listing.bathrooms != null && <span>{listing.bathrooms} baths</span>}
              {listing.toilets != null && listing.toilets > 0 && <span>{listing.toilets} toilets</span>}
              {listing.area != null && listing.area > 0 && <span>{listing.area} sqm</span>}
              {(listing.propertyTypes?.length || listing.propertyType) && (
                <span>{formatPropertyTypesLine(listing.propertyTypes, listing.propertyType)}</span>
              )}
            </div>
            {listing.amenities && listing.amenities.length > 0 && (
              <div className="mt-3 hidden flex-wrap gap-2 md:mt-4 md:flex">
                {listing.amenities.slice(0, 6).map((a) => (
                  <span key={a} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                    {a}
                  </span>
                ))}
                {listing.amenities.length > 6 && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                    +{listing.amenities.length - 6}
                  </span>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <VerifiedBadge
                role={listing.createdBy?.role ?? ''}
                isVerifiedAccount={listing.createdBy?.isVerifiedAccount ?? false}
                compact
              />
              <span className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition group-hover:bg-primary-700">
                View property →
              </span>
            </div>
          </div>
        </Link>
    );
  }

  if (data.type === 'ad' && data.ad) {
    const ad = data.ad;
    const isVideo = ad.media?.type === 'video';
    return slotWrap(
      className ? `${className} flex justify-center` : 'mt-6 flex justify-center',
      <Link
          href={ad.targetUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="card group block w-full max-w-lg overflow-hidden transition hover:shadow-lg"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
            {isVideo ? (
              <video
                src={ad.media.url}
                className="h-full w-full object-cover transition group-hover:scale-105"
                muted
                playsInline
                loop
                autoPlay
              />
            ) : (
              <Image
                {...listingImageProps(ad.media.url, 512)}
                alt="Ad"
                fill
                className="object-cover transition group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 512px"
              />
            )}
            <SponsoredLabel overlay className="absolute left-2 top-2" />
          </div>
        </Link>
    );
  }

  if (data.type === 'adsense' && data.adsenseCode) {
    return slotWrap(
      className ? `${className} flex justify-center` : 'mt-6 flex justify-center',
      <div className="relative w-full max-w-lg">
          <SponsoredLabel className="absolute right-3 top-2 z-10" />
          <HtmlAdEmbed
            html={data.adsenseCode}
            className="min-h-[120px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4"
          />
        </div>
    );
  }

  if (data.type === 'adsterra' && data.adsterraCode) {
    return slotWrap(
      className ? `${className} flex justify-center` : 'mt-6 flex justify-center',
      <div className="relative w-full max-w-lg">
          <SponsoredLabel className="absolute right-3 top-2 z-10" />
          <HtmlAdEmbed
            html={data.adsterraCode}
            className="min-h-[120px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4"
          />
        </div>
    );
  }

  return null;
}
