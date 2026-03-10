'use client';

import { USER_ROLES } from '@/lib/constants';

interface VerifiedBadgeProps {
  role: string;
  /** When true, show the caveat as subtle text below the badge (e.g. on detail/author pages). */
  showCaveat?: boolean;
  className?: string;
}

export function VerifiedBadge({ role, showCaveat, className = '' }: VerifiedBadgeProps) {
  let label: string | null = null;
  let caveat: string | null = null;

  // Group roles into user-friendly badge types, without exposing raw role names.
  if (role === USER_ROLES.REGISTERED_AGENT || role === USER_ROLES.REGISTERED_DEVELOPER) {
    label = 'Approved Professional Agent/Developer';
    caveat = 'Professionally verified by Digit Properties.';
  } else if (role === USER_ROLES.VERIFIED_INDIVIDUAL || role === USER_ROLES.ADMIN) {
    label = 'Verified Account';
    caveat = 'Identity and account verified by Digit Properties.';
  }

  if (!label) return null;

  return (
    <span className={`inline-flex flex-col gap-0.5 ${className}`}>
      <span
        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-primary-600 to-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-primary-500/40"
        title={caveat ?? undefined}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/15" aria-hidden>
          <svg
            className="h-3 w-3"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
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
