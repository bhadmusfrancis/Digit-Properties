'use client';

import Link from 'next/link';

type Variant = 'banner' | 'sidebar' | 'compact';

const LIST_HREF = '/listings/new';

function headline(listingType?: string): string {
  if (listingType === 'rent') return 'Rent or lease your property for FREE!';
  if (listingType === 'sale') return 'Sell your property for FREE!';
  return 'Sell or Rent your Property for FREE!';
}

function support(listingType?: string): string {
  if (listingType === 'rent') {
    return 'Have a vacant flat, house, or commercial space? List it in minutes — no listing fees, no agent lock-in.';
  }
  if (listingType === 'sale') {
    return 'Have land, a house, or an apartment to sell? Reach serious buyers across Nigeria — listing is free.';
  }
  return 'Have a house, land, or apartment for sale or lease? Go live in minutes. No listing fees.';
}

function ctaLabel(listingType?: string): string {
  if (listingType === 'rent') return 'List a rental for free';
  if (listingType === 'sale') return 'List a sale for free';
  return 'List your property free';
}

export function ListPropertyCta({
  listingType,
  variant = 'banner',
  className = '',
}: {
  listingType?: string;
  variant?: Variant;
  className?: string;
}) {
  const title = headline(listingType);
  const text = support(listingType);
  const action = ctaLabel(listingType);

  if (variant === 'sidebar') {
    return (
      <aside
        className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 p-5 text-white shadow-lg ring-1 ring-emerald-500/30 ${className}`}
      >
        <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-teal-400/20" aria-hidden />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100">Free to list</p>
        <h2 className="relative mt-1.5 text-lg font-extrabold leading-snug tracking-tight">{title}</h2>
        <p className="relative mt-2 text-sm leading-relaxed text-emerald-50">{text}</p>
        <ul className="relative mt-3 space-y-1.5 text-xs font-medium text-emerald-50">
          <li className="flex items-center gap-2">
            <CheckIcon /> No listing fees
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon /> Photos, video &amp; map
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon /> Buyers &amp; tenants nationwide
          </li>
        </ul>
        <Link
          href={LIST_HREF}
          className="relative mt-4 flex min-h-[44px] items-center justify-center rounded-lg bg-white px-4 py-2.5 text-center text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-emerald-600"
        >
          {action} →
        </Link>
      </aside>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={`flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
      >
        <div>
          <p className="text-sm font-bold text-emerald-950">{title}</p>
          <p className="mt-0.5 text-sm text-emerald-800">{text}</p>
        </div>
        <Link
          href={LIST_HREF}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          {action} →
        </Link>
      </div>
    );
  }

  return (
    <section
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-700 p-6 text-white shadow-xl sm:p-8 ${className}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-sky-400/20" aria-hidden />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Owners &amp; landlords</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-emerald-50 sm:text-lg">{text}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['No listing fees', 'Live in minutes', 'Sale or lease', 'Nigeria-wide reach'].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20"
              >
                <CheckIcon />
                {item}
              </span>
            ))}
          </div>
        </div>
        <Link
          href={LIST_HREF}
          className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-white px-8 py-3.5 text-center text-base font-extrabold text-emerald-800 shadow-lg transition hover:bg-emerald-50 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-700"
        >
          {action} →
        </Link>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}
