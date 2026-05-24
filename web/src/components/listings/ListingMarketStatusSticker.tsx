type MarketKind = 'sold' | 'rented';

function resolveMarketKind(
  soldAt?: string | Date | null,
  rentedAt?: string | Date | null
): MarketKind | null {
  if (soldAt) return 'sold';
  if (rentedAt) return 'rented';
  return null;
}

const STYLES: Record<
  MarketKind,
  { ribbon: string; banner: string; inline: string; label: string }
> = {
  sold: {
    ribbon: 'bg-red-600',
    banner: 'border-red-700 bg-red-600',
    inline: 'bg-red-600 text-white',
    label: 'SOLD',
  },
  rented: {
    ribbon: 'bg-indigo-600',
    banner: 'border-indigo-700 bg-indigo-600',
    inline: 'bg-indigo-600 text-white',
    label: 'RENTED',
  },
};

/** Prominent Sold / Rented sticker for listing thumbnails and detail gallery. */
export function ListingMarketStatusSticker({
  soldAt,
  rentedAt,
  variant = 'thumbnail',
  className = '',
}: {
  soldAt?: string | Date | null;
  rentedAt?: string | Date | null;
  variant?: 'thumbnail' | 'gallery' | 'inline';
  className?: string;
}) {
  const kind = resolveMarketKind(soldAt, rentedAt);
  if (!kind) return null;

  const styles = STYLES[kind];

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-bold uppercase tracking-wide shadow-sm ${styles.inline} ${className}`}
      >
        {styles.label}
      </span>
    );
  }

  if (variant === 'gallery') {
    return (
      <div
        className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/20 ${className}`}
        aria-hidden
      >
        <span
          className={`-rotate-12 border-4 border-white px-8 py-3 text-3xl font-black uppercase tracking-[0.2em] text-white shadow-2xl sm:text-4xl ${styles.banner}`}
        >
          {styles.label}
        </span>
      </div>
    );
  }

  return (
    <div className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${className}`} aria-hidden>
      <div className="absolute inset-0 bg-black/20" />
      <span
        className={`absolute left-1/2 top-1/2 w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-12 py-1.5 text-center text-sm font-black uppercase tracking-[0.15em] text-white shadow-lg sm:text-base ${styles.ribbon}`}
      >
        {styles.label}
      </span>
    </div>
  );
}
