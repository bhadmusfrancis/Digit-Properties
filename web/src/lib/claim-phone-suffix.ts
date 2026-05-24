import crypto from 'crypto';
import { isValidNigerianPhone, normalizePhone } from '@/lib/phone-verify';

/** Number of trailing digits the claimant must enter (national number, after 234). */
export const CLAIM_PHONE_SUFFIX_LEN = 5;

/** Visible prefix + masked trailing digits (e.g. 080 123•••••). */
export function formatPhoneClaimHint(rawPhone: string): string {
  const normalized = normalizePhone(rawPhone);
  if (!isValidNigerianPhone(normalized)) return '•••••••••••';
  const local = `0${normalized.slice(3)}`;
  const prefix = local.slice(0, -CLAIM_PHONE_SUFFIX_LEN);
  const suffixMask = '•'.repeat(CLAIM_PHONE_SUFFIX_LEN);
  if (prefix.length <= 4) return `${prefix}${suffixMask}`;
  return `${prefix.slice(0, 4)} ${prefix.slice(4)}${suffixMask}`;
}

export function phoneLastSuffixForClaim(normalized: string): string {
  const digits = normalizePhone(normalized).replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 13) {
    return digits.slice(-CLAIM_PHONE_SUFFIX_LEN);
  }
  const bare = digits.replace(/^234/, '');
  return bare.slice(-CLAIM_PHONE_SUFFIX_LEN).padStart(CLAIM_PHONE_SUFFIX_LEN, '0');
}

export function suffixMatchesListingPhone(suffix: string, rawPhone: string): boolean {
  const entered = suffix.replace(/\D/g, '');
  if (entered.length !== CLAIM_PHONE_SUFFIX_LEN) return false;
  const normalized = normalizePhone(rawPhone);
  if (!isValidNigerianPhone(normalized)) return false;
  const expected = phoneLastSuffixForClaim(normalized);
  try {
    return crypto.timingSafeEqual(Buffer.from(entered), Buffer.from(expected));
  } catch {
    return false;
  }
}
