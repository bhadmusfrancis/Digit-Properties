'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TREND_CATEGORIES, TREND_STATUS } from '@/lib/constants';
import { TrendImageUpload } from '@/components/trends/TrendImageUpload';

export default function AdminTrendNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(TREND_CATEGORIES[0]);
  const [imageUrl, setImageUrl] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState(TREND_STATUS.DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: slug || undefined,
          excerpt,
          content,
          category,
          imageUrl: imageUrl || undefined,
          author: author || undefined,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create');
        setSaving(false);
        return;
      }
      router.push('/admin/trends');
    } catch {
      setError('Request failed');
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-900">New trend post</h2>
      <p className="mt-1 text-sm text-gray-500">Create a news, trend, or journal post for the Trends section.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} className="input mt-1 w-full" placeholder="e.g. Lagos Property Market Q4 Outlook" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Slug (optional)</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="input mt-1 w-full" placeholder="url-slug (auto from title if empty)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input mt-1 w-full">
              {TREND_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Excerpt (meta / lead)</label>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className="input mt-1 w-full" placeholder="Short summary, 150–160 chars for SEO" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Content (HTML) *</label>
          <p className="mt-1 text-xs text-gray-500">Use significant section headings: e.g. &quot;Lagos Price Trends and Demand&quot;, &quot;How to Verify Title&quot;. Avoid generic headings like &quot;Conclusion&quot; or &quot;Summary&quot;. Use &lt;p&gt;, &lt;h2&gt;, &lt;h3&gt; for structure.</p>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={18} className="input mt-2 w-full font-mono text-sm" placeholder="<p>Intro...</p>&#10;<h2>Section heading</h2>&#10;<p>...</p>" />
        </div>
        <div>
          <TrendImageUpload imageUrl={imageUrl} onImageUrlChange={setImageUrl} disabled={saving} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Author</label>
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className="input mt-1 w-full" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input mt-1 w-full max-w-xs">
            <option value={TREND_STATUS.DRAFT}>Draft</option>
            <option value={TREND_STATUS.PUBLISHED}>Published</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create post'}</button>
          <Link href="/admin/trends" className="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
