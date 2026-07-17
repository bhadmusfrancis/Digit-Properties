import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { ListingForm } from '@/components/listings/ListingForm';
import type { ListingFormProps } from '@/components/listings/ListingForm';
import { LISTING_STATUS } from '@/lib/constants';
import { ListingOwnerStatusBanner } from '@/components/listings/ListingOwnerStatusBanner';
import { canUserEditListing } from '@/lib/listing-edit-window';
import { isWhatsAppImportListing } from '@/lib/whatsapp-description';
import { findListingByPublicParam } from '@/lib/resolve-listing';
import { isNextNavigationError } from '@/lib/utils';

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const { id: param } = await params;
    const callbackUrl = `/listings/${encodeURIComponent(param.trim())}/edit`;

    if (!session?.user?.id) {
      redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    const found = await findListingByPublicParam(param);
    if (!found || found.type !== 'listing') notFound();
    const listing = found.listing;
    const listingId = String(listing._id);

    // Prefer canonical id URLs for the editor (form PATCH uses ObjectId).
    if (param.trim() !== listingId) {
      redirect(`/listings/${listingId}/edit`);
    }

    if (
      !canUserEditListing({
        role: session.user.role,
        userId: session.user.id,
        listingCreatedBy: String(listing.createdBy),
        createdAt: listing.createdAt as Date,
        claimedAt: (listing as { claimedAt?: Date }).claimedAt,
      })
    ) {
      notFound();
    }

    const loc = listing.location as {
      address?: string;
      city?: string;
      state?: string;
      suburb?: string;
      coordinates?: { lat?: number; lng?: number };
    } | undefined;
    const savedCoords = loc?.coordinates;
    const coordinates =
      savedCoords &&
      typeof savedCoords.lat === 'number' &&
      typeof savedCoords.lng === 'number' &&
      Number.isFinite(savedCoords.lat) &&
      Number.isFinite(savedCoords.lng)
        ? { lat: savedCoords.lat, lng: savedCoords.lng }
        : undefined;
    const listingStatus = listing.status as string;
    const formStatus: 'draft' | 'active' =
      listingStatus === 'draft' || listingStatus === 'active' ? listingStatus : 'active';
    const contactSource: 'author' | 'listing' =
      (listing as { contactSource?: string }).contactSource === 'listing' ? 'listing' : 'author';
    const storedTypes = (listing as { propertyTypes?: string[] }).propertyTypes;
    const propertyTypesForForm =
      Array.isArray(storedTypes) && storedTypes.length > 0
        ? storedTypes
        : [listing.propertyType].filter(Boolean);

    const listingTags = Array.isArray(listing.tags) ? listing.tags.map(String) : [];
    const descriptionFormat = isWhatsAppImportListing(listingTags) ? 'whatsapp' : 'rich';

    const editInitial: ListingFormProps['editInitial'] = {
      title: listing.title,
      description: listing.description,
      listingType: listing.listingType,
      propertyTypes: propertyTypesForForm.length > 0 ? propertyTypesForForm : ['apartment'],
      price: listing.price,
      address: loc?.address ?? '',
      city: loc?.city ?? '',
      state: loc?.state ?? '',
      suburb: loc?.suburb ?? '',
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      toilets: listing.toilets,
      area: listing.area,
      amenities: Array.isArray(listing.amenities) ? listing.amenities.join(', ') : '',
      contactSource,
      agentName: listing.agentName ?? '',
      agentPhone: listing.agentPhone ?? '',
      agentEmail: listing.agentEmail ?? '',
      rentPeriod: listing.rentPeriod,
      status: formStatus,
      images: Array.isArray(listing.images)
        ? listing.images.map((img: { url?: string; public_id?: string }) => ({
            url: img?.url ?? '',
            public_id: img?.public_id ?? '',
          }))
        : [],
      videos: Array.isArray((listing as { videos?: { url?: string; public_id?: string }[] }).videos)
        ? (listing as { videos: { url?: string; public_id?: string }[] }).videos.map((v) => ({
            url: v?.url ?? '',
            public_id: v?.public_id ?? '',
          }))
        : [],
      coordinates,
    };

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Edit listing</h1>
          <Link href={`/listings/${listingId}`} className="text-sm text-primary-600 hover:underline">
            ← View listing
          </Link>
        </div>
        {listingStatus === LISTING_STATUS.PENDING_APPROVAL ? (
          <div className="mb-6">
            <ListingOwnerStatusBanner
              status={listingStatus}
              pendingApprovalReasons={
                Array.isArray((listing as { pendingApprovalReasons?: string[] }).pendingApprovalReasons)
                  ? (listing as { pendingApprovalReasons: string[] }).pendingApprovalReasons
                  : undefined
              }
            />
          </div>
        ) : null}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <ListingForm editId={listingId} editInitial={editInitial} descriptionFormat={descriptionFormat} />
        </div>
      </div>
    );
  } catch (e) {
    if (isNextNavigationError(e)) throw e;
    console.error('[EditListingPage]', e);
    throw e;
  }
}
