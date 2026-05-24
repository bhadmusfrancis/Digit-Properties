import { normalizePhone, isValidNigerianPhone } from '@/lib/phone-verify';
import { resolvePublicListingContact } from '@/lib/listing-contact-display';

/** Normalized Nigerian phone used to verify claims for this listing. */
export function getListingClaimPhone(listing: {
  agentPhone?: string | null;
  agentEmail?: string | null;
  contactSource?: string | null;
  createdByType?: string | null;
  createdBy?: unknown;
}): string | null {
  const contact = resolvePublicListingContact(listing);
  const raw = contact.agentPhone?.trim();
  if (!raw) {
    const creator = listing.createdBy;
    if (creator && typeof creator === 'object' && 'phone' in creator) {
      const p = (creator as { phone?: string }).phone?.trim();
      if (p) {
        const n = normalizePhone(p);
        return isValidNigerianPhone(n) ? n : null;
      }
    }
    return null;
  }
  const normalized = normalizePhone(raw);
  return isValidNigerianPhone(normalized) ? normalized : null;
}
