import type { IUser } from '@/models/User';
import { USER_ROLES } from '@/lib/constants';

/** Lean user, /api/me JSON, or aggregate — dates may be Date or ISO string. */
export type UserVerificationSnapshot = {
  role?: string | null;
  verifiedAt?: IUser['verifiedAt'] | string | null;
  phoneVerifiedAt?: IUser['phoneVerifiedAt'] | string | null;
  identityVerifiedAt?: IUser['identityVerifiedAt'] | string | null;
  livenessVerifiedAt?: IUser['livenessVerifiedAt'] | string | null;
};

function hasVerificationTimestamp(v: unknown): boolean {
  if (v == null || v === '') return false;
  if (v instanceof Date) return !isNaN(v.getTime());
  if (typeof v === 'string') return v.trim().length > 0;
  return Boolean(v);
}

/** Populate/select these fields so listing cards can compute `isVerifiedAccount`. */
export const USER_PUBLIC_BADGE_FIELDS =
  'firstName name image role verifiedAt phoneVerifiedAt identityVerifiedAt livenessVerifiedAt' as const;

export type PublicCreatedBy = {
  _id: string;
  firstName?: string;
  name?: string;
  image?: string;
  role?: string;
  isVerifiedAccount: boolean;
};

/**
 * Base verification = email + phone + ID + liveness.
 * Required for contact visibility on listings (see listing contact API).
 */
export function hasBaseVerification(user: UserVerificationSnapshot): boolean {
  if (user.role === USER_ROLES.ADMIN) return true;
  return (
    hasVerificationTimestamp(user.verifiedAt) &&
    hasVerificationTimestamp(user.phoneVerifiedAt) &&
    hasVerificationTimestamp(user.identityVerifiedAt) &&
    hasVerificationTimestamp(user.livenessVerifiedAt)
  );
}

/**
 * Whether to show a public trust badge (listing/search/author). False for bots.
 * Only users whose role reflects **admin-approved** verification (not guests pending review).
 */
export function isPublicVerifiedAccount(user: UserVerificationSnapshot | null | undefined): boolean {
  if (!user || typeof user !== 'object') return false;
  const role = String(user.role || '').toLowerCase();
  if (role === USER_ROLES.BOT || role === USER_ROLES.GUEST) return false;
  if (role === USER_ROLES.ADMIN) return true;
  if (role === USER_ROLES.REGISTERED_AGENT || role === USER_ROLES.REGISTERED_DEVELOPER) return true;
  if (role === USER_ROLES.VERIFIED_INDIVIDUAL) return true;
  return false;
}

/** Normalize populated `createdBy` for public APIs and UI. */
export function shapePublicCreatedBy(createdBy: unknown): PublicCreatedBy | null {
  if (!createdBy || typeof createdBy !== 'object') return null;
  const o = createdBy as Record<string, unknown>;
  if (o._id == null) return null;
  const vf: UserVerificationSnapshot = {
    role: typeof o.role === 'string' ? o.role : '',
    verifiedAt: o.verifiedAt as UserVerificationSnapshot['verifiedAt'],
    phoneVerifiedAt: o.phoneVerifiedAt as UserVerificationSnapshot['phoneVerifiedAt'],
    identityVerifiedAt: o.identityVerifiedAt as UserVerificationSnapshot['identityVerifiedAt'],
    livenessVerifiedAt: o.livenessVerifiedAt as UserVerificationSnapshot['livenessVerifiedAt'],
  };
  return {
    _id: String(o._id),
    firstName: typeof o.firstName === 'string' ? o.firstName : undefined,
    name: typeof o.name === 'string' ? o.name : undefined,
    image: typeof o.image === 'string' ? o.image : undefined,
    role: vf.role || undefined,
    isVerifiedAccount: isPublicVerifiedAccount(vf),
  };
}
