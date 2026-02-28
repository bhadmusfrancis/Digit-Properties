'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { TREND_CATEGORIES, TREND_STATUS } from '@/lib/constants';
import { TrendImageUpload } from '@/components/trends/TrendImageUpload';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

export default function AdminTrendEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<(typeof TREND_CATEGORIES)[number]>(TREND_CATEGORIES[0]);
  const [imageUrl, setImageUrl] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<(typeof TREND_STATUS)[keyof typeof TREND_STATUS]>(TREND_STATUS.DRAFT);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setError('');
    fetch(`/api/admin/trends/${id}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data?.error || 'Failed to load post');
          setLoading(false);
          return;
        }
        setTitle(data.title ?? '');
        setSlug(data.slug ?? '');
        setExcerpt(data.excerpt ?? '');
        setContent(data.content ?? '');
        setCategory(data.category ?? TREND_CATEGORIES[0]);
        setImageUrl(data.imageUrl ?? '');
        setAuthor(data.author ?? '');
        setStatus(data.status ?? TREND_STATUS.DRAFT);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleGenerateImage() {
    setError('');
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/trends/${id}/generate-image`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Generate image failed');
        setGenerating(false);
        return;
      }
      if (data.url) setImageUrl(data.url);
    } catch {
      setError('Request failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const textOnly = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!textOnly) {
      setError('Content is required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/trends/${id}`, {
        method: 'PUT',
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
        setError(data.error || 'Failed to update');
        setSaving(false);
        return;
      }
      router.push('/admin/trends');
    } catch {
      setError('Request failed');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error && !title && !content) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-red-700">{error}</p>
        <Link href="/admin/trends" className="mt-4 inline-block text-primary-600 hover:underline">← Back to Trends</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-gray-900">Edit trend post</h2>
        {slug && (
          <Link href={`/trends/${slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline">
            View post →
          </Link>
        )}
      </div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} className="input mt-1 w-full" placeholder="e.g. Lagos Property Market Q4 Outlook" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Slug (URL)</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="input mt-1 w-full" placeholder="auto from title if empty" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as (typeof TREND_CATEGORIES)[number])} className="input mt-1 w-full">
              {TREND_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Excerpt (meta / lead)</label>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className="input mt-1 w-full" placeholder="Short summary, 150–160 chars for SEO" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Content *</label>
          <p className="mt-1 text-xs text-gray-500">Use the toolbar for bold, headings (H2, H3), and lists. Use significant section headings for SEO.</p>
          <div className="mt-2">
            <RichTextEditor value={content} onChange={setContent} minHeight="280px" disabled={saving} />
          </div>
          {!content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() && (
            <p className="mt-1 text-xs text-red-600">Content is required.</p>
          )}
        </div>
        <div>
          <TrendImageUpload imageUrl={imageUrl} onImageUrlChange={setImageUrl} disabled={saving} />
          <div className="mt-3">
            <button
              type="button"
              onClick={handleGenerateImage}
              disabled={saving || generating}
              className="rounded-lg border border-primary-300 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-800 hover:bg-primary-100 disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate image from post content'}
            </button>
            <p className="mt-1 text-xs text-gray-500">Assigns a unique photo (Picsum) and uploads to Cloudinary. No API key needed.</p>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Author</label>
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className="input mt-1 w-full" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof TREND_STATUS)[keyof typeof TREND_STATUS])} className="input mt-1 w-full max-w-xs">
            <option value={TREND_STATUS.DRAFT}>Draft</option>
            <option value={TREND_STATUS.PUBLISHED}>Published</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save changes'}</button>
          <Link href="/admin/trends" className="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
