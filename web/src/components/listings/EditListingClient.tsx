'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { ListingForm, type ListingFormProps } from '@/components/listings/ListingForm';
import { ListingOwnerStatusBanner } from '@/components/listings/ListingOwnerStatusBanner';
import { isWhatsAppImportListing } from '@/lib/whatsapp-description';

type EditListingPayload = {
  _id: string;
  title?: string;
  description?: string;
  listingType?: string;
  propertyType?: string;
  propertyTypes?: string[];
  price?: number;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    suburb?: string;
    coordinates?: { lat?: number; lng?: number };
  };
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  area?: number;
  amenities?: string[];
  contactSource?: string;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  rentPeriod?: 'day' | 'month' | 'year';
  status?: string;
  tags?: string[];
  images?: { url?: string; public_id?: string }[];
  videos?: { url?: string; public_id?: string }[];
  pendingApprovalReasons?: string[];
};

function buildEditInitial(listing: EditListingPayload): NonNullable<ListingFormProps['editInitial']> {
  const loc = listing.location;
  const savedCoords = loc?.coordinates;
  const coordinates =
    savedCoords &&
    typeof savedCoords.lat === 'number' &&
    typeof savedCoords.lng === 'number' &&
    Number.isFinite(savedCoords.lat) &&
    Number.isFinite(savedCoords.lng)
      ? { lat: savedCoords.lat, lng: savedCoords.lng }
      : undefined;

  const listingStatus = listing.status;
  const formStatus: 'draft' | 'active' =
    listingStatus === 'draft' || listingStatus === 'active' ? listingStatus : 'active';
  const contactSource: 'author' | 'listing' =
    listing.contactSource === 'listing' ? 'listing' : 'author';
  const storedTypes = listing.propertyTypes;
  const propertyTypesForForm =
    Array.isArray(storedTypes) && storedTypes.length > 0
      ? storedTypes
      : [listing.propertyType].filter((t): t is string => typeof t === 'string' && !!t);

  const rawAddress = typeof loc?.address === 'string' ? loc.address.trim() : '';
  const address =
    rawAddress.length >= 5
      ? rawAddress.slice(0, 500)
      : [loc?.suburb, loc?.city, loc?.state].filter(Boolean).join(', ') || 'Address pending';

  return {
    title: listing.title,
    description: listing.description,
    listingType: (listing.listingType as 'sale' | 'rent' | undefined) ?? 'sale',
    propertyTypes: propertyTypesForForm.length > 0 ? propertyTypesForForm : ['apartment'],
    price: typeof listing.price === 'number' && listing.price > 0 ? listing.price : 1,
    address,
    city: loc?.city ?? '',
    state: loc?.state ?? '',
    suburb: loc?.suburb ?? '',
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    toilets: listing.toilets,
    area: listing.area,
    amenities: Array.isArray(listing.amenities) ? listing.amenities.map(String).join(', ') : '',
    contactSource,
    agentName: listing.agentName ?? '',
    agentPhone: listing.agentPhone ?? '',
    agentEmail: listing.agentEmail ?? '',
    rentPeriod: listing.rentPeriod,
    status: formStatus,
    images: Array.isArray(listing.images)
      ? listing.images
          .filter((img) => img?.url || img?.public_id)
          .map((img) => ({ url: img?.url ?? '', public_id: img?.public_id ?? '' }))
      : [],
    videos: Array.isArray(listing.videos)
      ? listing.videos
          .filter((v) => v?.url || v?.public_id)
          .map((v) => ({ url: v?.url ?? '', public_id: v?.public_id ?? '' }))
      : [],
    coordinates,
  };
}

export function EditListingClient({ listingParam }: { listingParam: string }) {
  const { status: authStatus } = useSession();
  const listingId = listingParam.trim();

  const {
    data: listing,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['listing-for-edit', listingId],
    enabled: authStatus === 'authenticated' && !!listingId,
    queryFn: async (): Promise<EditListingPayload> => {
      const r = await fetch(`/api/listings/${encodeURIComponent(listingId)}?forEdit=1`);
      const body = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error('Please sign in again to edit this listing.');
      if (r.status === 403) throw new Error('You do not have permission to edit this listing.');
      if (r.status === 404) throw new Error('Listing not found.');
      if (r.status === 400) throw new Error(typeof body?.error === 'string' ? body.error : 'Invalid listing id.');
      if (!r.ok) {
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to load listing for edit.');
      }
      return body as EditListingPayload;
    },
    retry: false,
  });

  const editInitial = useMemo(
    () => (listing ? buildEditInitial(listing) : undefined),
    [listing]
  );

  const descriptionFormat =
    listing && isWhatsAppImportListing(Array.isArray(listing.tags) ? listing.tags : [])
      ? 'whatsapp'
      : 'rich';

  if (authStatus === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Sign in required</h1>
        <p className="mt-2 text-gray-600">Please sign in to edit this listing.</p>
        <Link href="/auth/signin" className="btn-primary mt-6 inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  if (authStatus === 'loading' || isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 h-96 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Unable to open editor</h1>
        <p className="mt-2 text-gray-600">{(error as Error).message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <button type="button" onClick={() => refetch()} className="btn-primary">
            Try again
          </button>
          <Link href="/admin/listings" className="btn-secondary">
            Admin listings
          </Link>
        </div>
      </div>
    );
  }

  if (!listing || !editInitial) return null;

  const listingStatus = listing.status;
  const resolvedId = String(listing._id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Edit listing</h1>
        <Link href={`/listings/${resolvedId}`} className="text-sm text-primary-600 hover:underline">
          ← View listing
        </Link>
      </div>
      {listingStatus === 'pending_approval' ? (
        <div className="mb-6">
          <ListingOwnerStatusBanner
            status={listingStatus}
            pendingApprovalReasons={
              Array.isArray(listing.pendingApprovalReasons) ? listing.pendingApprovalReasons : undefined
            }
          />
        </div>
      ) : null}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <ListingForm
          editId={resolvedId}
          editInitial={editInitial}
          descriptionFormat={descriptionFormat}
        />
      </div>
    </div>
  );
}
