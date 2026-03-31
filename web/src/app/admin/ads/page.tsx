'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AD_PLACEMENTS } from '@/lib/constants';

const PLACEMENT_LABELS: Record<string, string> = {
  home_featured: 'Homepage',
  search: 'Search page',
  listings: 'Listings page',
};

type AdRow = {
  _id: string;
  placement: string;
  media: { url: string; type: string };
  startDate: string;
  endDate: string;
  targetUrl: string;
  status: string;
  paymentId?: string;
  userId: { name?: string; email?: string } | string;
  rejectionReason?: string;
  createdAt: string;
};

export default function AdminAdsPage() {
  const [ads, setAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  function fetchAds() {
    setLoading(true);
    const url = filter ? `/api/admin/ads?status=${encodeURIComponent(filter)}` : '/api/admin/ads';
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.ads) setAds(d.ads);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAds();
  }, [filter]);

  function approve(id: string) {
    setActing(id);
    fetch(`/api/admin/ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) alert(data.error);
        else fetchAds();
      })
      .finally(() => setActing(null));
  }

  function reject(id: string) {
    const reason = rejectReason[id] || '';
    setActing(id);
    fetch(`/api/admin/ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejectionReason: reason }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) alert(data.error);
        else fetchAds();
      })
      .finally(() => setActing(null));
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">User ads</h2>
      <p className="mt-1 text-sm text-gray-500">
        Approve or reject paid ad requests. Set placement pricing and AdSense in{' '}
        <Link href="/admin/config" className="text-primary-600 hover:underline">Subscription config</Link> (Ad section).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input min-h-11 w-full min-w-[12rem] max-w-md text-sm sm:w-auto"
        >
          <option value="">All statuses</option>
          <option value="pending_approval">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {loading ? (
        <p className="mt-4 text-gray-500">Loading…</p>
      ) : (
        <div className="mt-4 -mx-1 overflow-x-auto rounded-lg border border-gray-200 bg-white px-1 shadow-sm sm:mx-0 sm:px-0">
          <table className="min-w-[36rem] divide-y divide-gray-200 sm:min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">User</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Placement
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Creative</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Period
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {ads.map((ad) => (
                <tr key={ad._id}>
                  <td className="max-w-[10rem] truncate px-3 py-3 text-sm text-gray-900 sm:max-w-none sm:px-4" title={typeof ad.userId === 'object' && ad.userId ? String((ad.userId as { email?: string }).email ?? (ad.userId as { name?: string }).name ?? '') : String(ad.userId)}>
                    {typeof ad.userId === 'object' && ad.userId
                      ? (ad.userId as { name?: string; email?: string }).email ?? (ad.userId as { name?: string }).name
                      : ad.userId}
                  </td>
                  <td className="hidden px-4 py-3 text-sm sm:table-cell">
                    {PLACEMENT_LABELS[ad.placement] ?? ad.placement}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {ad.media?.type === 'image' ? (
                      <a href={ad.media.url} target="_blank" rel="noopener noreferrer" className="block relative w-20 h-14 rounded overflow-hidden bg-gray-100">
                        <Image src={ad.media.url} alt="Ad" fill className="object-cover" sizes="80px" />
                      </a>
                    ) : (
                      <a href={ad.media?.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600">Video</a>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-gray-600 md:table-cell">
                    <span className="whitespace-nowrap">{new Date(ad.startDate).toLocaleString()}</span>
                    <span className="text-gray-400"> – </span>
                    <span className="whitespace-nowrap">{new Date(ad.endDate).toLocaleString()}</span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      ad.status === 'approved' ? 'bg-green-100 text-green-800' :
                      ad.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {ad.status}
                    </span>
                  </td>
                  <td className="min-w-[8.5rem] px-3 py-3 sm:min-w-0 sm:px-4">
                    {ad.status === 'pending_approval' && (
                      <div className="flex max-w-[14rem] flex-col gap-2 sm:max-w-none">
                        {!ad.paymentId ? (
                          <span className="text-xs text-gray-500">Unpaid</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => approve(ad._id)}
                              disabled={!!acting}
                              className="text-sm font-medium text-green-600 hover:underline"
                            >
                              Approve
                            </button>
                            <input
                              type="text"
                              placeholder="Rejection reason (optional)"
                              value={rejectReason[ad._id] ?? ''}
                              onChange={(e) => setRejectReason((r) => ({ ...r, [ad._id]: e.target.value }))}
                              className="w-40 rounded border border-gray-300 px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => reject(ad._id)}
                              disabled={!!acting}
                              className="text-sm font-medium text-red-600 hover:underline"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ads.length === 0 && (
            <div className="py-12 text-center text-gray-500">No ads match.</div>
          )}
        </div>
      )}
      <p className="mt-6">
        <Link href="/admin/config" className="text-sm text-primary-600 hover:underline">Ad pricing & AdSense →</Link>
      </p>
      <p className="mt-2">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}
