import type { IUser } from '@/models/User';
import { USER_ROLES } from '@/lib/constants';

/**
 * Base verification = email + phone + ID + liveness.
 * Required for contact visibility on listings (see listing contact API).
 */
export function hasBaseVerification(user: Pick<IUser, 'verifiedAt' | 'phoneVerifiedAt' | 'identityVerifiedAt' | 'livenessVerifiedAt' | 'role'>): boolean {
  if (user.role === USER_ROLES.ADMIN) return true;
  return !!(
    user.verifiedAt &&
    user.phoneVerifiedAt &&
    user.identityVerifiedAt &&
    user.livenessVerifiedAt
  );
}
