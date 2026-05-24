'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AuthorLikeButton } from '@/components/authors/AuthorLikeButton';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { getListingDisplayImage } from '@/lib/listing-default-image';
import { formatPrice } from '@/lib/utils';
import { formatListingTypeLabel } from '@/lib/constants';
import { toFirstName } from '@/lib/display-name';
import { isBotListingAuthor } from '@/lib/claimable-listing';
import {
  LISTING_TRUST_CAVEAT_TEXT,
  shouldShowListingTrustCaveat,
} from '@/lib/listing-trust-caveat';
import { formatUserRoleLabel } from '@/lib/user-role-label';
import type { PublicCreatedBy } from '@/lib/verification';

type AuthorListingPreview = {
  _id: string;
  title: string;
  price: number;
  listingType: string;
  rentPeriod?: string;
  propertyType: string;
  location?: { city?: string; state?: string };
  images?: { url: string }[];
  videos?: { url: string; public_id?: string }[];
};

type AuthorProfilePayload = {
  author: PublicCreatedBy & { companyPosition?: string };
  totalListings: number;
  likeCount: number;
  reviewStats: { avgRating: number; totalReviews: number };
  listings: AuthorListingPreview[];
};

function StarRating({ avg, count }: { avg: number; count: number }) {
  const filled = Math.round(avg);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-0.5" aria-label={`${avg.toFixed(1)} out of 5 stars, ${count} reviews`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            className={`h-4 w-4 ${i <= filled ? 'text-amber-400' : 'text-gray-200'}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-[11px] font-medium text-gray-600 tabular-nums">
        {count > 0 ? `${avg.toFixed(1)} · ${count} review${count !== 1 ? 's' : ''}` : 'No reviews yet'}
      </span>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white/80 px-2 py-2.5 shadow-sm ring-1 ring-gray-100">
      <span className="text-lg font-bold tabular-nums text-gray-900">{value}</span>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
    </div>
  );
}

export function ListingAuthorPanel({
  authorId,
  createdBy,
  createdByType,
  currentListingId,
  embedded = false,
}: {
  authorId: string | undefined;
  createdBy: PublicCreatedBy | null;
  createdByType: string;
  currentListingId: string;
  /** Compact layout inside the combined Contact tab; constrains horizontal scroll. */
  embedded?: boolean;
}) {
  if (isBotListingAuthor({ createdByType, createdBy })) {
    return null;
  }

  const displayName = toFirstName(createdBy?.firstName, createdBy?.name, 'Author');
  const showTrustCaveat = shouldShowListingTrustCaveat({
    role: createdBy?.role,
    createdByType,
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ['author-profile', authorId],
    queryFn: async () => {
      const r = await fetch(`/api/authors/${authorId}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Failed to load author');
      return j as AuthorProfilePayload;
    },
    enabled: !!authorId,
  });

  if (!createdBy) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        Author information is not available for this listing.
      </p>
    );
  }

  const profile = data?.author ?? createdBy;
  const name = toFirstName(profile.firstName, profile.name, displayName);
  const image = profile.image;
  const role = profile.role ?? createdBy.role;
  const companyPosition =
    data?.author && 'companyPosition' in data.author
      ? (data.author as { companyPosition?: string }).companyPosition
      : undefined;
  const totalListings = data?.totalListings ?? 0;
  const likeCount = data?.likeCount ?? 0;
  const reviewStats = data?.reviewStats ?? { avgRating: 0, totalReviews: 0 };
  const otherListings = (data?.listings ?? []).filter((l) => l._id !== currentListingId).slice(0, 6);

  return (
    <div className="min-w-0 space-y-4">
      {embedded && (
        <h4 className="text-sm font-semibold text-gray-900">Listed by</h4>
      )}
      <div className="overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-emerald-50/40 shadow-sm">
        <div className={embedded ? 'p-4' : 'p-5'}>
          <div className="flex items-start gap-3 sm:gap-4">
            <div
              className={`relative shrink-0 overflow-hidden rounded-2xl bg-white shadow-md ring-2 ring-white ${
                embedded ? 'h-16 w-16' : 'h-20 w-20'
              }`}
            >
              {image && image.startsWith('http') ? (
                <Image src={image} alt="" fill className="object-cover" sizes="80px" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-500 to-emerald-500 text-2xl font-bold text-white">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <h4 className={`font-bold leading-tight text-gray-900 ${embedded ? 'text-base' : 'text-lg'}`}>
                {name}
              </h4>
              <p className="mt-0.5 text-sm text-gray-600">{formatUserRoleLabel(role)}</p>
              {companyPosition && (
                <p className="mt-1 text-sm font-medium text-primary-700">{companyPosition}</p>
              )}
              <div className="mt-2">
                <VerifiedBadge
                  role={role ?? ''}
                  isVerifiedAccount={profile.isVerifiedAccount ?? createdBy.isVerifiedAccount}
                  showCaveat
                />
              </div>
            </div>
          </div>

          {isPending && authorId ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200/80" aria-hidden />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <StatCell label="Listings" value={isError ? '—' : totalListings} />
                <div className="flex flex-col items-center justify-center rounded-xl bg-white/80 px-2 py-2.5 shadow-sm ring-1 ring-gray-100">
                  <StarRating avg={reviewStats.avgRating} count={reviewStats.totalReviews} />
                </div>
              </div>
              {!isError && likeCount > 0 && (
                <p className="mt-2 text-center text-xs text-gray-500 tabular-nums">
                  {likeCount} author like{likeCount !== 1 ? 's' : ''} from the community
                </p>
              )}
            </>
          )}

          {authorId && (
            <div className="mt-4 rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm">
              <AuthorLikeButton
                authorId={authorId}
                variant="panel"
                signInCallbackUrl={`/listings/${currentListingId}`}
              />
            </div>
          )}

          {showTrustCaveat && (
            <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              {LISTING_TRUST_CAVEAT_TEXT}
            </p>
          )}
        </div>
      </div>

      {authorId && !isPending && otherListings.length > 0 && (
        <div className="min-w-0">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            More from {name.split(' ')[0]}
          </h5>
          <div className="mt-2 min-w-0 w-full max-w-full overflow-hidden">
            <ul className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 snap-x snap-mandatory [scrollbar-gutter:stable]">
            {otherListings.map((listing) => (
              <li key={listing._id} className="w-[8.75rem] shrink-0 snap-start sm:w-[9.5rem]">
                <Link
                  href={`/listings/${listing._id}`}
                  className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-primary-200 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] bg-gray-100">
                    <Image
                      src={getListingDisplayImage(listing.images, listing.propertyType, listing.videos)}
                      alt={listing.title}
                      fill
                      className="object-cover transition group-hover:scale-105"
                      sizes="152px"
                    />
                    <span className="absolute right-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-gray-800">
                      {formatListingTypeLabel(listing.listingType)}
                    </span>
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-xs font-semibold text-gray-900">{listing.title}</p>
                    <p className="mt-0.5 text-xs font-bold text-primary-600">
                      {formatPrice(listing.price, listing.listingType === 'rent' ? listing.rentPeriod : undefined)}
                    </p>
                    {listing.location?.city && (
                      <p className="mt-0.5 truncate text-[10px] text-gray-500">
                        {listing.location.city}
                        {listing.location.state ? `, ${listing.location.state}` : ''}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
            </ul>
          </div>
          {totalListings > otherListings.length + 1 && (
            <p className="mt-2 text-center text-xs text-gray-500">
              +{totalListings - otherListings.length - 1} more active listing
              {totalListings - otherListings.length - 1 !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {authorId && isError && (
        <p className="text-center text-xs text-red-600">Could not load full author profile.</p>
      )}
    </div>
  );
}
