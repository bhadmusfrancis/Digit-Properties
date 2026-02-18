/**
 * Check alerts matching a new listing and send email notifications.
 * Called when a listing is published (status = active).
 */
import { dbConnect } from '@/lib/db';
import Alert from '@/models/Alert';
import Listing from '@/models/Listing';
import { sendAlertMatchEmail } from '@/lib/email';
import type { IListing } from '@/models/Listing';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';

interface ListingMatch {
  _id: string;
  title: string;
  price: number;
  listingType: string;
  rentPeriod?: string;
}

function listingMatchesAlert(listing: IListing, filters: Record<string, unknown>): boolean {
  if (filters.listingType && filters.listingType !== listing.listingType) return false;
  if (filters.propertyType && filters.propertyType !== listing.propertyType) return false;
  if (typeof filters.minPrice === 'number' && listing.price < filters.minPrice) return false;
  if (typeof filters.maxPrice === 'number' && listing.price > filters.maxPrice) return false;
  if (filters.state && filters.state !== listing.location?.state) return false;
  if (filters.city && filters.city !== listing.location?.city) return false;
  if (typeof filters.bedrooms === 'number' && listing.bedrooms < filters.bedrooms) return false;
  if (typeof filters.bathrooms === 'number' && listing.bathrooms < filters.bathrooms) return false;
  if (filters.rentPeriod && filters.rentPeriod !== listing.rentPeriod) return false;
  if (Array.isArray(filters.tags) && filters.tags.length > 0) {
    const listingTags = (listing.tags || []).map((t) => t.toLowerCase());
    const hasTag = filters.tags.some((t: unknown) =>
      listingTags.includes(String(t).toLowerCase())
    );
    if (!hasTag) return false;
  }
  return true;
}

/** Run in background - don't await. Notify users whose alerts match this listing. */
export async function notifyMatchingAlerts(listing: IListing): Promise<void> {
  try {
    await dbConnect();
    const alerts = await Alert.find({ notifyEmail: true })
      .populate('userId', 'email')
      .lean();

    const listingData: ListingMatch = {
      _id: String(listing._id),
      title: listing.title,
      price: listing.price,
      listingType: listing.listingType,
      rentPeriod: listing.rentPeriod,
    };

    for (const alert of alerts) {
      if (!listingMatchesAlert(listing, alert.filters || {})) continue;
      const user = alert.userId as { email?: string } | null;
      if (!user?.email) continue;
      await sendAlertMatchEmail(user.email, alert.name, [listingData], BASE_URL);
      await Alert.findByIdAndUpdate(alert._id, { lastNotifiedAt: new Date() }).catch(() => {});
    }
  } catch (e) {
    console.error('[alerts] notifyMatchingAlerts error:', e);
  }
}
