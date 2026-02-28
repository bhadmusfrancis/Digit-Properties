'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

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

  function runSeed(force: boolean) {
    if (!force && posts.length > 0 && !confirm('Trends already exist. Add 30 seed posts anyway (duplicates by title may be skipped)?')) return;
    if (force && !confirm('This will delete all existing trend posts and insert 30 seed posts. Continue?')) return;
    setSeeding(true);
    fetch('/api/admin/trends/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.count > 0) {
          setCategory('');
          setStatusFilter('');
          fetch('/api/admin/trends?limit=20')
            .then((r) => r.json())
            .then((data) => {
              if (data.posts) setPosts(data.posts);
              if (data.pagination) setPagination(data.pagination);
            });
        }
        alert(d.message || (d.error || 'Done'));
      })
      .catch(() => alert('Seed request failed'))
      .finally(() => setSeeding(false));
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Trends (News &amp; Journals)</h2>
        <div className="flex gap-2">
          <Link href="/admin/trends/new" className="btn-primary text-sm">
            Add post
          </Link>
          <button type="button" onClick={() => runSeed(false)} disabled={seeding} className="btn border border-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-50">
            {seeding ? 'Seeding…' : 'Seed 30 posts'}
          </button>
          <button type="button" onClick={() => runSeed(true)} disabled={seeding} className="btn border border-amber-300 bg-amber-50 text-amber-800 text-sm hover:bg-amber-100 disabled:opacity-50" title="Delete all trends and insert 30 full SEO posts with images">
            Re-seed (replace all)
          </button>
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
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-16 px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:w-20 sm:px-3">Image</th>
                <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Title</th>
                <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Category</th>
                <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Status</th>
                <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Updated</th>
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
                  <td className="px-4 py-3 text-sm text-gray-600">{p.category}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-NG') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/trends/${p.slug}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-sm mr-3">
                      View
                    </Link>
                    <Link href={`/admin/trends/${p._id}/edit`} className="text-primary-600 hover:underline text-sm mr-3">
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deletePost(p._id); }}
                      disabled={deleting === p._id}
                      className="text-red-600 hover:underline text-sm disabled:opacity-50"
                    >
                      {deleting === p._id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && (
            <div className="py-12 text-center text-gray-500">No trend posts yet. Add one or run the seed.</div>
          )}
        </div>
      )}
    </div>
  );
}
