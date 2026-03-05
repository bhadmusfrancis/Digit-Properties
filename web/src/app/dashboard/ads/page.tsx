'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AD_PLACEMENTS, AD_MEDIA_RECOMMENDED } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';

const PLACEMENT_LABELS: Record<string, string> = {
  home_featured: 'Homepage (Featured slot)',
  search: 'Search results page',
  listings: 'Property listings page',
};

type AdItem = {
  _id: string;
  placement: string;
  media: { url: string; type: string };
  startDate: string;
  endDate: string;
  targetUrl: string;
  status: string;
  amountPaid?: number;
  paymentId?: string;
  rejectionReason?: string;
  createdAt: string;
};

export default function DashboardAdsPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === 'true';
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payingAdId, setPayingAdId] = useState<string | null>(null);
  const [form, setForm] = useState({
    placement: 'home_featured',
    media: null as { public_id: string; url: string; type: 'image' | 'video' } | null,
    startDate: '',
    startTime: '09:00',
    durationHours: 24,
    targetUrl: '',
    useHourlyPricing: false,
  });
  const [uploading, setUploading] = useState(false);
  const [createdAd, setCreatedAd] = useState<{ adId: string; amount: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (success) {
      setCreatedAd(null);
      fetchAds();
    }
  }, [success]);

  function fetchAds() {
    setLoading(true);
    fetch('/api/ads')
      .then((r) => r.json())
      .then((data) => {
        if (data.ads) setAds(data.ads);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchAds();
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('folder', 'ads');
    fetch('/api/upload', { method: 'POST', body: fd })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setForm((f) => ({
          ...f,
          media: { public_id: data.public_id, url: data.url, type: data.type === 'video' ? 'video' : 'image' },
        }));
      })
      .catch((err) => setError(err.message || 'Upload failed'))
      .finally(() => setUploading(false));
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.media || !form.targetUrl.trim()) {
      setError('Upload an image/video and enter redirect URL.');
      return;
    }
    const start = new Date(`${form.startDate}T${form.startTime}`);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
      setError('Start date/time must be in the future.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setCreatedAd(null);
    fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placement: form.placement,
        media: form.media,
        startDate: start.toISOString(),
        durationHours: form.durationHours,
        targetUrl: form.targetUrl.trim(),
        useHourlyPricing: form.useHourlyPricing,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCreatedAd({ adId: data.ad._id, amount: data.amount, currency: data.currency || 'NGN' });
        fetchAds();
      })
      .catch((err) => setError(err.message || 'Failed to create ad'))
      .finally(() => setSubmitting(false));
  }

  function startPayment(adId: string, gateway: 'paystack' | 'flutterwave') {
    setPayingAdId(adId);
    setError(null);
    fetch('/api/payments/ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId, gateway }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (data.authorization_url) window.location.href = data.authorization_url;
        else if (data.link) window.location.href = data.link;
        else throw new Error('No payment link');
      })
      .catch((err) => setError(err.message || 'Payment failed'))
      .finally(() => setPayingAdId(null));
  }

  const statusLabel: Record<string, string> = {
    pending_approval: 'Pending approval',
    approved: 'Approved',
    rejected: 'Rejected',
    active: 'Active',
    expired: 'Expired',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Advertise</h1>
      <p className="mt-1 text-gray-600">
        Run your ad on the homepage, search, or listings. Upload creative, choose placement and schedule, then pay. Ads require admin approval after payment.
      </p>

      {success && (
        <div className="mt-4 rounded-lg bg-green-50 p-4 text-green-800">
          Payment received. Your ad is pending admin approval and will go live in the selected period.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {createdAd && (
        <div className="mt-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
          <p className="font-medium text-primary-900">Ad created. Pay to submit for approval.</p>
          <p className="mt-1 text-primary-700">
            Amount: {formatPrice(createdAd.amount)} ({createdAd.currency})
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => startPayment(createdAd.adId, 'paystack')}
              disabled={!!payingAdId}
              className="btn bg-primary-600 text-white hover:bg-primary-700"
            >
              Pay with Paystack
            </button>
            <button
              type="button"
              onClick={() => startPayment(createdAd.adId, 'flutterwave')}
              disabled={!!payingAdId}
              className="btn border border-gray-300 bg-white hover:bg-gray-50"
            >
              Pay with Flutterwave
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-4">
        <button
          type="button"
          onClick={() => { setShowForm(!showForm); setError(null); setCreatedAd(null); }}
          className="btn bg-primary-600 text-white hover:bg-primary-700"
        >
          {showForm ? 'Cancel' : 'Create new ad'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitCreate} className="mt-6 max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">
            Recommended image size: {AD_MEDIA_RECOMMENDED.width}×{AD_MEDIA_RECOMMENDED.height} px (SEO/social). Max 10MB image, 50MB video.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Ad creative (image or video)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={onFileChange} className="mt-1 block w-full text-sm text-gray-600 file:mr-4 file:rounded file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-primary-700" />
            {uploading && <span className="ml-2 text-sm text-gray-500">Uploading…</span>}
            {form.media && (
              <p className="mt-1 text-sm text-green-600">
                Uploaded ({form.media.type}). <button type="button" onClick={() => setForm((f) => ({ ...f, media: null }))} className="underline">Remove</button>
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Placement</label>
            <select
              value={form.placement}
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
            >
              {AD_PLACEMENTS.map((p) => (
                <option key={p} value={p}>{PLACEMENT_LABELS[p] ?? p}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Start time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Duration (hours)</label>
            <input
              type="number"
              min={1}
              value={form.durationHours}
              onChange={(e) => setForm((f) => ({ ...f, durationHours: parseInt(e.target.value, 10) || 24 }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.useHourlyPricing}
                onChange={(e) => setForm((f) => ({ ...f, useHourlyPricing: e.target.checked }))}
              />
              <span className="text-sm font-medium text-gray-700">Use hourly pricing (otherwise daily)</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Redirect URL</label>
            <input
              type="url"
              placeholder="https://..."
              value={form.targetUrl}
              onChange={(e) => setForm((f) => ({ ...f, targetUrl: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
              required
            />
          </div>
          <button type="submit" disabled={submitting || !form.media} className="btn bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create ad & see price'}
          </button>
        </form>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">My ads</h2>
        {loading ? (
          <p className="mt-2 text-gray-500">Loading…</p>
        ) : ads.length === 0 ? (
          <p className="mt-2 text-gray-500">No ads yet. Create one above.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Placement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {ads.map((ad) => (
                  <tr key={ad._id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{PLACEMENT_LABELS[ad.placement] ?? ad.placement}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(ad.startDate).toLocaleString()} – {new Date(ad.endDate).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        ad.status === 'approved' ? 'bg-green-100 text-green-800' :
                        ad.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {statusLabel[ad.status] ?? ad.status}
                      </span>
                      {ad.rejectionReason && (
                        <p className="mt-1 text-xs text-red-600">{ad.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!ad.paymentId && ad.status === 'pending_approval' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startPayment(ad._id, 'paystack')}
                            disabled={!!payingAdId}
                            className="text-sm font-medium text-primary-600 hover:underline"
                          >
                            Pay (Paystack)
                          </button>
                          <button
                            type="button"
                            onClick={() => startPayment(ad._id, 'flutterwave')}
                            disabled={!!payingAdId}
                            className="text-sm font-medium text-primary-600 hover:underline"
                          >
                            Pay (Flutterwave)
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
