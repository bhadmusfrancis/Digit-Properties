import { normalizePhone, isValidNigerianPhone } from '@/lib/phone-verify';

/** Normalized Nigerian phone used to verify claims for this listing. */
export function getListingClaimPhone(listing: {
  agentPhone?: string | null;
  agentEmail?: string | null;
  contactSource?: string | null;
  createdByType?: string | null;
  createdBy?: unknown;
}): string | null {
  // Claims verify ownership of the original poster's number captured on the
  // listing (agentPhone) — not the public author/bot contact shown on the page.
  const raw = typeof listing.agentPhone === 'string' ? listing.agentPhone.trim() : '';
  if (raw) {
    const normalized = normalizePhone(raw);
    return isValidNigerianPhone(normalized) ? normalized : null;
  }

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
