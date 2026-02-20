import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { ListingForm } from '@/components/listings/ListingForm';
import { USER_ROLES } from '@/lib/constants';
import mongoose from 'mongoose';

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) notFound();

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await dbConnect();
  const listing = await Listing.findById(id).lean();
  if (!listing) notFound();

  const isAdmin = session.user.role === USER_ROLES.ADMIN;
  const isOwner = String(listing.createdBy) === session.user.id;
  if (!isAdmin && !isOwner) notFound();

  const loc = listing.location as { address?: string; city?: string; state?: string; suburb?: string } | undefined;
  const editInitial = {
    title: listing.title,
    description: listing.description,
    listingType: listing.listingType,
    propertyType: listing.propertyType,
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
    agentName: listing.agentName ?? '',
    agentPhone: listing.agentPhone ?? '',
    agentEmail: listing.agentEmail ?? '',
    rentPeriod: listing.rentPeriod,
    status: listing.status,
    images: listing.images ?? [],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Edit listing</h1>
        <Link href={`/listings/${id}`} className="text-sm text-primary-600 hover:underline">
          ← View listing
        </Link>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <ListingForm editId={id} editInitial={editInitial} />
      </div>
    </div>
  );
}
