import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { EditListingClient } from '@/components/listings/EditListingClient';

/**
 * Thin RSC shell: auth redirect only.
 * Listing data loads client-side via GET /api/listings/:id?forEdit=1 so this
 * page never imports Mongoose/Listing (Turbopack interop crash on models.Listing).
 */
export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const { id: param } = await params;
  const listingParam = param.trim();
  const callbackUrl = `/listings/${encodeURIComponent(listingParam)}/edit`;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return <EditListingClient listingParam={listingParam} />;
}
