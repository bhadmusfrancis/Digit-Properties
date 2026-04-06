'use client';

import { USER_ROLES } from '@/lib/constants';

interface VerifiedBadgeProps {
  role: string;
  /**
   * From API (`shapePublicCreatedBy`): user completed identity verification even if `role` is still `guest`
   * or fields were not previously populated.
   */
  isVerifiedAccount?: boolean;
  /** When true, show the caveat as subtle text below the badge (e.g. on detail/author pages). */
  showCaveat?: boolean;
  /** Shorter chip for cards and listing titles. */
  compact?: boolean;
  className?: string;
}

export function VerifiedBadge({
  role,
  isVerifiedAccount = false,
  showCaveat,
  compact,
  className = '',
}: VerifiedBadgeProps) {
  const r = (role || '').toLowerCase();
  if (r === USER_ROLES.BOT) return null;

  let label: string | null = null;
  let caveat: string | null = null;

  if (r === USER_ROLES.REGISTERED_AGENT || r === USER_ROLES.REGISTERED_DEVELOPER) {
    label = compact ? 'Pro verified' : 'Approved Professional Agent/Developer';
    caveat = 'Professionally verified by Digit Properties.';
  } else if (
    r === USER_ROLES.VERIFIED_INDIVIDUAL ||
    r === USER_ROLES.ADMIN ||
    isVerifiedAccount
  ) {
    label = compact ? 'Verified' : 'Verified Account';
    caveat = 'Identity and account verified by Digit Properties.';
  }

  if (!label) return null;

  const chipClass = compact
    ? 'inline-flex items-center gap-1 rounded-full border border-white/20 bg-gradient-to-r from-primary-600 to-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm shadow-primary-500/30'
    : 'inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-primary-600 to-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-primary-500/40';

  const iconWrapClass = compact
    ? 'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-white/15'
    : 'flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/15';

  const iconClass = compact ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <span className={`inline-flex flex-col gap-0.5 ${className}`}>
      <span className={chipClass} title={caveat ?? undefined}>
        <span className={iconWrapClass} aria-hidden>
          <svg className={iconClass} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 1.667 3.333 5v5c0 3.5 2.8 6.733 6.667 8.333 3.867-1.6 6.667-4.833 6.667-8.333V5L10 1.667Z"
              fill="currentColor"
              className="text-emerald-300"
            />
            <path
              d="M8.333 11.667 6.667 10l-.942.942 2.608 2.608 5-5L12.392 7.7l-4.059 3.967Z"
              fill="#0F172A"
            />
          </svg>
        </span>
        <span>{label}</span>
      </span>
      {showCaveat && caveat && (
        <span className="text-[11px] text-gray-500" title={caveat}>
          {caveat}
        </span>
      )}
    </span>
  );
}
