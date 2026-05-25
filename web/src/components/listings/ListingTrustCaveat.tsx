import {
  LISTING_TRUST_CAVEAT_TEXT,
  shouldShowListingTrustCaveat,
  type ListingTrustCaveatInput,
} from '@/lib/listing-trust-caveat';

const VARIANT_CLASS: Record<'detail' | 'panel' | 'compact', string> = {
  detail:
    'rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-xs leading-relaxed text-amber-900',
  panel:
    'rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] leading-relaxed text-amber-800',
  compact: 'text-[10px] leading-snug text-amber-800/95',
};

export function ListingTrustCaveat({
  role,
  createdByType,
  isVerifiedAccount,
  variant = 'detail',
  className = '',
}: ListingTrustCaveatInput & {
  variant?: keyof typeof VARIANT_CLASS;
  className?: string;
}) {
  if (!shouldShowListingTrustCaveat({ role, createdByType, isVerifiedAccount })) {
    return null;
  }

  return (
    <p
      role="note"
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      aria-label="Listing authenticity notice"
    >
      {variant === 'compact' && (
        <span className="mr-1 inline-block align-middle text-amber-600" aria-hidden>
          ⓘ
        </span>
      )}
      {LISTING_TRUST_CAVEAT_TEXT}
    </p>
  );
}
