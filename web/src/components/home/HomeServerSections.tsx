import Link from 'next/link';
import { ListingGrid } from '@/components/listings/ListingGrid';
import type { HomeListingRow } from '@/lib/homepage-listings-server';

type HomeFeaturedListingsProps = {
  listings: HomeListingRow[];
};

/** Server-rendered featured listing grid so homepage always shows inventory to crawlers. */
export function HomeFeaturedListings({ listings }: HomeFeaturedListingsProps) {
  if (!listings.length) return null;
  return (
    <div className="mt-6">
      <ListingGrid listings={listings} />
    </div>
  );
}

type HomeTrendHighlightsProps = {
  posts: Array<{ _id: string; title: string; slug: string; excerpt: string; category: string }>;
};

/** Server-rendered trends strip — visible even before client JS loads. */
export function HomeTrendHighlights({ posts }: HomeTrendHighlightsProps) {
  if (!posts.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Trends &amp; Insights</h2>
        <Link href="/trends" className="text-primary-600 font-medium hover:underline">
          View all →
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">News, market trends, events, and journals on Nigerian real estate.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((p) => (
          <Link
            key={p._id}
            href={`/trends/${p.slug}`}
            className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
          >
            <span className="text-xs font-medium text-primary-600">{p.category}</span>
            <h3 className="mt-1 font-semibold text-gray-900 line-clamp-2">{p.title}</h3>
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{p.excerpt}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
