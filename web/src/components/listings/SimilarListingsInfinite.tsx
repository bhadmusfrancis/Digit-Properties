'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ListingGrid } from '@/components/listings/ListingGrid';

const PAGE_SIZE = 12;

export interface SimilarListingItem {
  _id: string;
  title: string;
  price: number;
  listingType: string;
  rentPeriod?: 'day' | 'month' | 'year';
  propertyType: string;
  location: { address?: string; city?: string; state?: string; suburb?: string };
  bedrooms: number;
  bathrooms: number;
  toilets?: number;
  images?: { url: string; public_id?: string }[];
  videos?: { url: string; public_id?: string }[];
  isBoosted?: boolean;
  createdBy?: { _id?: string; firstName?: string; name?: string; role?: string };
}

type Props = {
  listingId: string;
  initialListings: SimilarListingItem[];
  /** Override default subtitle under "Similar properties" */
  subtitle?: string;
};

const DEFAULT_SUBTITLE = 'Same property type · with photos or videos · closest first';

export function SimilarListingsInfinite({ listingId, initialListings, subtitle = DEFAULT_SUBTITLE }: Props) {
  const [listings, setListings] = useState<SimilarListingItem[]>(initialListings);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadedCountRef = useRef(initialListings.length);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    const skip = loadedCountRef.current;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/similar?skip=${skip}&limit=${PAGE_SIZE}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const next = Array.isArray(data.listings) ? data.listings : [];
      loadedCountRef.current = skip + next.length;
      setListings((prev) => [...prev, ...next]);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [listingId, hasMore, loading]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) loadMore();
      },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (listings.length === 0) return null;

  return (
    <section className="mt-12 border-t border-gray-200 pt-10">
      <h2 className="text-xl font-semibold text-gray-900">Similar properties</h2>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      <ListingGrid listings={listings} />
      <div ref={sentinelRef} className="h-4 min-h-4" aria-hidden />
      {loading && (
        <div className="mt-6 flex justify-center">
          <p className="text-sm text-gray-500">Loading more…</p>
        </div>
      )}
    </section>
  );
}
