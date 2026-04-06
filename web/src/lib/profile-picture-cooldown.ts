/** Minimum interval between profile photo URL changes (manual upload or liveness replacement). */
export const PROFILE_PICTURE_CHANGE_COOLDOWN_MONTHS = 3;

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Anchor for cooldown: explicit change time, or (legacy) when liveness set the current photo.
 */
export function getLastProfileImageChangeForCooldown(user: {
  profileImageChangedAt?: Date | string | null;
  livenessVerifiedAt?: Date | string | null;
  image?: string | null;
}): Date | null {
  const explicit = user.profileImageChangedAt;
  if (explicit != null && explicit !== '') {
    const d = explicit instanceof Date ? explicit : new Date(explicit);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const lv = user.livenessVerifiedAt;
  const img = typeof user.image === 'string' ? user.image.trim() : '';
  if (img && lv != null && lv !== '') {
    const d = lv instanceof Date ? lv : new Date(lv);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function getNextProfilePictureChangeAt(lastChange: Date | null): Date | null {
  if (!lastChange) return null;
  return addMonths(lastChange, PROFILE_PICTURE_CHANGE_COOLDOWN_MONTHS);
}

export function isProfilePictureChangeAllowed(lastChange: Date | null): boolean {
  const next = getNextProfilePictureChangeAt(lastChange);
  if (!next) return true;
  return Date.now() >= next.getTime();
}
