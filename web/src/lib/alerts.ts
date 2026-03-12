/**
 * Check alerts matching a new listing and send email + push notifications.
 * Called when a listing is published (status = active).
 */
import { dbConnect } from '@/lib/db';
import Alert from '@/models/Alert';
import { sendAlertMatchEmail } from '@/lib/email';
import { sendPushNotification } from '@/lib/send-push';
import type { IListing } from '@/models/Listing';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Digit Properties';

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
  if (filters.state && String(filters.state).trim() !== String(listing.location?.state ?? '').trim()) return false;
  if (filters.city && String(filters.city).trim().toLowerCase() !== String(listing.location?.city ?? '').trim().toLowerCase()) return false;
  if (filters.suburb && String(filters.suburb).trim().toLowerCase() !== String(listing.location?.suburb ?? '').trim().toLowerCase()) return false;
  if (typeof filters.bedrooms === 'number' && (listing.bedrooms ?? 0) < filters.bedrooms) return false;
  if (typeof filters.bathrooms === 'number' && (listing.bathrooms ?? 0) < filters.bathrooms) return false;
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

/** Run in background - don't await. Notify users whose alerts match this listing (email + push). */
export async function notifyMatchingAlerts(listing: IListing): Promise<void> {
  try {
    await dbConnect();
    const alerts = await Alert.find({
      $or: [{ notifyEmail: true }, { notifyPush: true }],
    })
      .populate('userId', 'email fcmTokens')
      .lean();

    const listingData: ListingMatch = {
      _id: String(listing._id),
      title: listing.title,
      price: listing.price,
      listingType: listing.listingType,
      rentPeriod: listing.rentPeriod,
    };

    const listingUrl = `${BASE_URL}/listings/${listing._id}`;
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(listing.price);
    const pushTitle = `${APP_NAME}: New listing`;
    const pushBody = `${listing.title} – ${priceStr}`;

    for (const alert of alerts) {
      if (!listingMatchesAlert(listing, alert.filters || {})) continue;
      const user = alert.userId as { _id?: unknown; email?: string; fcmTokens?: string[] } | null;
      if (!user) continue;

      if (alert.notifyEmail && user.email) {
        await sendAlertMatchEmail(user.email, alert.name, [listingData], BASE_URL);
      }
      if (alert.notifyPush && Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
        await sendPushNotification(user.fcmTokens, pushTitle, pushBody, {
          url: listingUrl,
          listingId: String(listing._id),
        });
      }
      await Alert.findByIdAndUpdate(alert._id, { lastNotifiedAt: new Date() }).catch(() => {});
    }
  } catch (e) {
    console.error('[alerts] notifyMatchingAlerts error:', e);
  }
}
