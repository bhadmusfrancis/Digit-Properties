'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { formatPrice } from '@/lib/utils';
import { MyListingActions } from './MyListingActions';

type ListingRow = {
  _id: string;
  title: string;
  price: number;
  status: string;
  listingType: string;
  rentPeriod?: string;
  images?: { url?: string; public_id?: string }[];
  featured?: boolean;
  highlighted?: boolean;
};

type Limits = {
  featuredCount: number;
  highlightedCount: number;
  maxFeatured: number;
  maxHighlighted: number;
  canFeatured: boolean;
  canHighlighted: boolean;
};

/** Local overlay for optimistic featured/highlighted so checkbox updates immediately */
type OptimisticRow = { featured?: boolean; highlighted?: boolean };

export function MyListingsTable({ listings }: { listings: ListingRow[] }) {
  const router = useRouter();
  const [limits, setLimits] = useState<Limits | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, OptimisticRow>>({});

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setLimits({
          featuredCount: d.featuredCount ?? 0,
          highlightedCount: d.highlightedCount ?? 0,
          maxFeatured: d.maxFeatured ?? 0,
          maxHighlighted: d.maxHighlighted ?? 0,
          canFeatured: d.canFeatured ?? false,
          canHighlighted: d.canHighlighted ?? false,
        });
      })
      .catch(() => {});
  }, []);

  const toggle = async (e: React.SyntheticEvent, listingId: string, field: 'featured' | 'highlighted', current: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !current;
    if (limits) {
      if (field === 'featured' && next && (!limits.canFeatured || limits.featuredCount >= limits.maxFeatured)) {
        alert('Featured listings require Gold or Premium. Upgrade to feature this listing.');
        return;
      }
      if (field === 'highlighted' && next && (!limits.canHighlighted || limits.highlightedCount >= limits.maxHighlighted)) {
        alert('Highlighted listings require Gold or Premium. Upgrade to highlight this listing.');
        return;
      }
    }
    setToggling(`${listingId}-${field}`);
    setOptimistic((prev) => ({
      ...prev,
      [listingId]: { ...prev[listingId], [field]: next },
    }));
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.refresh();
        setOptimistic((prev) => {
          const nextState = { ...prev };
          delete nextState[listingId];
          return nextState;
        });
      } else {
        setOptimistic((prev) => {
          const cur = prev[listingId];
          if (!cur) return prev;
          const { [field]: _, ...rest } = cur;
          const nextState = { ...prev };
          if (Object.keys(rest).length === 0) delete nextState[listingId];
          else nextState[listingId] = rest as OptimisticRow;
          return nextState;
        });
        if (data.error) alert(data.error);
      }
    } finally {
      setToggling(null);
    }
  };

  const getDisplay = (l: ListingRow) => ({
    featured: optimistic[l._id]?.featured ?? l.featured,
    highlighted: optimistic[l._id]?.highlighted ?? l.highlighted,
  });

  const thumb = (l: ListingRow) => {
    const url = l.images?.[0]?.url;
    if (url) {
      return <img src={url} alt="" className="h-12 w-16 rounded object-cover bg-gray-100" />;
    }
    return <div className="h-12 w-16 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">No img</div>;
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-16 px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:w-20 sm:px-3">Image</th>
            <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Title</th>
            <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Price</th>
            <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Status</th>
            <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Featured / Highlighted</th>
            <th className="px-2 py-3 text-right text-xs font-medium uppercase text-gray-500 sm:px-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {listings.map((l) => {
            const display = getDisplay(l);
            return (
            <tr
              key={l._id}
              onClick={() => router.push(`/listings/${l._id}`)}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                {thumb(l)}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{l.title}</td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {formatPrice(l.price, l.listingType === 'rent' ? l.rentPeriod : undefined)}
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    l.status === 'active' ? 'bg-green-100 text-green-800' : l.status === 'draft' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {l.status}
                </span>
              </td>
              <td className="px-2 py-3 sm:px-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!display.featured}
                      onChange={(e) => toggle(e, l._id, 'featured', !!display.featured)}
                      disabled={
                        toggling === `${l._id}-featured` ||
                        (limits != null && limits.canFeatured && !display.featured && limits.featuredCount >= limits.maxFeatured)
                      }
                      title={
                        limits?.canFeatured
                          ? display.featured
                            ? 'Remove from Featured (home carousel)'
                            : `Featured (${limits?.featuredCount ?? 0}/${limits?.maxFeatured ?? 0})`
                          : 'Upgrade for Featured'
                      }
                      className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                    />
                    <span className={display.featured ? 'font-medium text-amber-700' : 'text-gray-600'}>
                      {toggling === `${l._id}-featured` ? '…' : 'Featured'}
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!display.highlighted}
                      onChange={(e) => toggle(e, l._id, 'highlighted', !!display.highlighted)}
                      disabled={
                        toggling === `${l._id}-highlighted` ||
                        (limits != null && limits.canHighlighted && !display.highlighted && limits.highlightedCount >= limits.maxHighlighted)
                      }
                      title={
                        limits?.canHighlighted
                          ? display.highlighted
                            ? 'Remove from Highlighted (search)'
                            : `Highlighted (${limits?.highlightedCount ?? 0}/${limits?.maxHighlighted ?? 0})`
                          : 'Upgrade for Highlighted'
                      }
                      className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 disabled:opacity-50"
                    />
                    <span className={display.highlighted ? 'font-medium text-sky-700' : 'text-gray-600'}>
                      {toggling === `${l._id}-highlighted` ? '…' : 'Highlighted'}
                    </span>
                  </label>
                </div>
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <MyListingActions listingId={l._id} />
              </td>
            </tr>
          );
          })}
        </tbody>
      </table>
      {listings.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No listings yet.{' '}
          <Link href="/listings/new" className="text-primary-600 hover:underline" onClick={(e) => e.stopPropagation()}>
            Create one
          </Link>
        </div>
      )}
    </div>
  );
}
