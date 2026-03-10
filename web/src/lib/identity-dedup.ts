import mongoose from 'mongoose';
import User from '@/models/User';

/** Normalize name for comparison: lowercase, single spaces, trimmed */
export function normalizeNameForCompare(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Normalize DOB for comparison: digits only, first 8 (YYYYMMDD or DDMMYYYY). */
export function normalizeDobForCompare(
  d: string | Date | null | undefined
): string {
  if (d == null) return '';
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }
  const parsed = String(d).replace(/\D/g, '');
  return parsed.length >= 8 ? parsed.slice(0, 8) : parsed;
}

/**
 * Check if another verified account already has this identity (firstName + lastName + DOB).
 * Returns the existing user if found, null otherwise.
 */
export async function findExistingVerifiedIdentity(
  firstName: string,
  lastName: string,
  dateOfBirth: string | Date | null | undefined,
  excludeUserId: string
): Promise<{ _id: mongoose.Types.ObjectId } | null> {
  const first = normalizeNameForCompare(firstName);
  const last = normalizeNameForCompare(lastName);
  const dob = normalizeDobForCompare(dateOfBirth);
  if (!first || !last || !dob) return null;

  const users = await User.find({
    identityVerifiedAt: { $ne: null },
    _id: { $ne: new mongoose.Types.ObjectId(excludeUserId) },
  })
    .select('firstName lastName dateOfBirth idScannedData')
    .lean();

  for (const u of users) {
    const uFirst = normalizeNameForCompare(
      (u.firstName ?? (u.idScannedData as { firstName?: string })?.firstName) ?? ''
    );
    const uLast = normalizeNameForCompare(
      (u.lastName ?? (u.idScannedData as { lastName?: string })?.lastName) ?? ''
    );
    const uDob = normalizeDobForCompare(
      u.dateOfBirth ?? (u.idScannedData as { dateOfBirth?: string })?.dateOfBirth
    );
    if (uFirst === first && uLast === last && uDob === dob) return u as { _id: mongoose.Types.ObjectId };
  }
  return null;
}
