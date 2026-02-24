'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';
import { AdminListingActions } from './AdminListingActions';

type User = { _id: string; name?: string; email?: string };
type Listing = {
  _id: string;
  title: string;
  price: number;
  status: string;
  listingType: string;
  rentPeriod?: string;
  images?: { url?: string; public_id?: string }[];
  featured?: boolean;
  highlighted?: boolean;
  createdBy: unknown;
};

export function AdminListingsTable({ listings, users }: { listings: Listing[]; users: User[] }) {
  const router = useRouter();

  const thumb = (l: Listing) => {
    const url = l.images?.[0]?.url;
    if (url) return <img src={url} alt="" className="h-12 w-16 rounded object-cover bg-gray-100" />;
    return <div className="h-12 w-16 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">No img</div>;
  };

  const createdByLabel = (l: Listing) => {
    if (l.createdBy && typeof l.createdBy === 'object' && '_id' in l.createdBy) {
      const o = l.createdBy as { name?: string; email?: string };
      return o.name ?? o.email ?? '—';
    }
    return '—';
  };
  const createdById = (l: Listing) => {
    if (l.createdBy && typeof l.createdBy === 'object' && '_id' in l.createdBy)
      return String((l.createdBy as { _id: unknown })._id);
    return String(l.createdBy);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 w-20">Image</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 hidden sm:table-cell">Created by</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {listings.map((l) => (
            <tr
              key={l._id}
              onClick={() => router.push(`/listings/${l._id}`)}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                {thumb(l)}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] sm:max-w-xs truncate">{l.title}</td>
              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
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
              <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{createdByLabel(l)}</td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <AdminListingActions
                  listingId={l._id}
                  status={l.status}
                  createdById={createdById(l)}
                  createdByLabel={createdByLabel(l)}
                  users={users}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {listings.length === 0 && (
        <div className="py-12 text-center text-gray-500">No listings yet.</div>
      )}
    </div>
  );
}
