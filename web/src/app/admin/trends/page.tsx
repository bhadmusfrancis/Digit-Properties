'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TREND_CATEGORIES, TREND_STATUS } from '@/lib/constants';

type Post = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  status: string;
  imageUrl?: string;
  publishedAt?: string;
  updatedAt: string;
};

export default function AdminTrendsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (statusFilter) params.set('status', statusFilter);
    params.set('limit', '20');
    fetch(`/api/admin/trends?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.posts) setPosts(d.posts);
        if (d.pagination) setPagination(d.pagination);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, statusFilter]);

  function deletePost(id: string) {
    if (!confirm('Delete this trend post?')) return;
    setDeleting(id);
    fetch(`/api/admin/trends/${id}`, { method: 'DELETE' })
      .then((r) => {
        if (r.ok) setPosts((prev) => prev.filter((p) => p._id !== id));
      })
      .finally(() => setDeleting(null));
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Trends (News &amp; Journals)</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/trends/new" className="btn-primary text-sm min-h-[44px] inline-flex items-center justify-center touch-manipulation">
            Add post
          </Link>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input w-auto text-sm"
        >
          <option value="">All categories</option>
          {TREND_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto text-sm"
        >
          <option value="">All statuses</option>
          <option value={TREND_STATUS.DRAFT}>Draft</option>
          <option value={TREND_STATUS.PUBLISHED}>Published</option>
        </select>
      </div>
      {loading ? (
        <p className="mt-6 text-gray-500">Loading…</p>
      ) : (
        <div className="mt-6 overflow-x-hidden rounded-lg border border-gray-200 bg-white shadow">
          <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-16 px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:w-20 sm:px-3">Image</th>
                <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Title</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Status</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Updated</th>
                <th className="px-2 py-3 text-right text-xs font-medium uppercase text-gray-500 sm:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {posts.map((p) => (
                <tr
                  key={p._id}
                  onClick={() => window.open(`/trends/${p.slug}`, '_blank')}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="h-12 w-16 rounded object-cover bg-gray-100" />
                    ) : (
                      <div className="h-12 w-16 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">No img</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">{p.title}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-600">{p.category}</td>
                  <td className="px-2 py-3 sm:px-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-500">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-NG') : '—'}
                  </td>
                  <td className="px-2 py-3 text-right sm:px-4" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/trends/${p.slug}`} target="_blank" rel="noopener noreferrer" className="inline-block min-h-[44px] min-w-[44px] py-2 px-2 -m-1 rounded text-primary-600 hover:underline text-sm touch-manipulation">View</Link>
                    <Link href={`/admin/trends/${p._id}/edit`} className="inline-block min-h-[44px] min-w-[44px] py-2 px-2 -m-1 rounded text-primary-600 hover:underline text-sm touch-manipulation">Edit</Link>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deletePost(p._id); }}
                      disabled={deleting === p._id}
                      className="min-h-[44px] min-w-[44px] py-2 px-2 -m-1 rounded text-red-600 hover:underline text-sm disabled:opacity-50 touch-manipulation"
                    >
                      {deleting === p._id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && (
            <div className="py-12 text-center text-gray-500">No trend posts yet. Add one to get started.</div>
          )}
        </div>
      )}
    </div>
  );
}
