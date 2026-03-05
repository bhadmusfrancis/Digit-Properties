'use client';

import { USER_ROLES } from '@/lib/constants';

const BADGE_LABELS: Record<string, string> = {
  [USER_ROLES.VERIFIED_INDIVIDUAL]: 'Verified Individual',
  [USER_ROLES.REGISTERED_AGENT]: 'Registered Agent',
  [USER_ROLES.REGISTERED_DEVELOPER]: 'Registered Developer',
  [USER_ROLES.ADMIN]: 'Admin',
};

/** Short caveat per badge type, shown as tooltip and optionally as inline text. */
const BADGE_CAVEATS: Record<string, string> = {
  [USER_ROLES.VERIFIED_INDIVIDUAL]: 'Identity and liveness verified.',
  [USER_ROLES.REGISTERED_AGENT]: 'Professional credentials reviewed by Digit Properties.',
  [USER_ROLES.REGISTERED_DEVELOPER]: 'Professional credentials reviewed by Digit Properties.',
  [USER_ROLES.ADMIN]: 'Platform administrator.',
};

interface VerifiedBadgeProps {
  role: string;
  /** When true, show the caveat as subtle text below the badge (e.g. on detail/author pages). */
  showCaveat?: boolean;
  className?: string;
}

export function VerifiedBadge({ role, showCaveat, className = '' }: VerifiedBadgeProps) {
  const label = BADGE_LABELS[role];
  const caveat = BADGE_CAVEATS[role];
  if (!label) return null;

  return (
    <span className={`inline-flex flex-col gap-0.5 ${className}`}>
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-800"
        title={caveat ?? undefined}
      >
        <span className="size-3 shrink-0 rounded-full bg-primary-500" aria-hidden />
        {label}
      </span>
      {showCaveat && caveat && (
        <span className="text-[11px] text-gray-500" title={caveat}>
          {caveat}
        </span>
      )}
    </span>
  );
}
