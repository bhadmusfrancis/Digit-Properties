'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AD_PLACEMENTS, AD_MEDIA_RECOMMENDED } from '@/lib/constants';
import { AD_PLACEMENT_LABELS, getAdPlacementLabel } from '@/lib/ad-placements';
import { formatPrice } from '@/lib/utils';
import type { AdPricingMode, PlacementPricingRates } from '@/lib/ad-placements';
import { resolvePlacementRates } from '@/lib/ad-placements';
import { SystemNotice } from '@/components/ui/SystemNotice';
import { useSystemToast } from '@/components/ui/SystemToast';

const PLACEMENT_LABELS = AD_PLACEMENT_LABELS;

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

const DURATION_LABEL: Record<AdPricingMode, string> = {
  hourly: 'Duration (hours)',
  daily: 'Duration (days)',
  weekly: 'Duration (weeks)',
  monthly: 'Duration (months)',
};

export default function DashboardAdsPage() {
  const searchParams = useSearchParams();
  const notify = useSystemToast();
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
    duration: 1,
    targetUrl: '',
    pricingMode: 'daily' as AdPricingMode,
  });
  const [uploading, setUploading] = useState(false);
  const [createdAd, setCreatedAd] = useState<{ adId: string; amount: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placementPricing, setPlacementPricing] = useState<Record<string, PlacementPricingRates>>({});

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
        if (data.placementPricing && typeof data.placementPricing === 'object') {
          setPlacementPricing(data.placementPricing);
        }
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
        duration: form.duration,
        targetUrl: form.targetUrl.trim(),
        pricingMode: form.pricingMode,
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

  function startPayment(adId: string, gateway: 'paystack' | 'flutterwave' | 'wallet') {
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
        if (data.paidWithWallet) {
          notify.success('Ad paid with Ad credit', 'Your ad is pending admin approval.');
          fetchAds();
          setCreatedAd(null);
          return;
        }
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

  const selectedRates = resolvePlacementRates(
    placementPricing[form.placement] || {
      pricePerDay: 5000,
      pricePerHour: 500,
      pricePerWeek: 30000,
      pricePerMonth: 100000,
      currency: 'NGN',
    }
  );

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Advertise</h1>
      <p className="mt-1 text-gray-600">
        Run your ad on the homepage, listing search, listing detail, or trends pages. Upload creative, choose placement and schedule, then pay by the hour, day, week, or month. Ads require admin approval after payment.
      </p>

      {success && (
        <SystemNotice kind="success" title="Payment received" className="mt-4">
          Your ad is pending admin approval and will go live in the selected period.
        </SystemNotice>
      )}

      {error && (
        <SystemNotice kind="error" title="Something went wrong" className="mt-4">
          {error}
        </SystemNotice>
      )}

      {createdAd && (
        <SystemNotice kind="info" title="Ad created. Pay to submit for approval." className="mt-4">
          <p>
            Amount: {formatPrice(createdAd.amount)} ({createdAd.currency})
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => startPayment(createdAd.adId, 'wallet')}
              disabled={!!payingAdId}
              className="btn bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Pay with Ad credit
            </button>
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
        </SystemNotice>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => { setShowForm(!showForm); setError(null); setCreatedAd(null); }}
          className="btn bg-primary-600 text-white hover:bg-primary-700"
        >
          {showForm ? 'Cancel' : 'Create new ad'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitCreate} className="mt-6 max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <label className="block text-sm font-medium text-gray-700">Billing period</label>
            <select
              value={form.pricingMode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pricingMode: e.target.value as AdPricingMode,
                  duration: e.target.value === 'hourly' ? 24 : 1,
                }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Advert bookings are charged once for the selected period (hour, day, week, or month). This is separate from listing boosts.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ['hourly', 'Per hour', selectedRates.pricePerHour],
                ['daily', 'Per day', selectedRates.pricePerDay],
                ['weekly', 'Per week', selectedRates.pricePerWeek],
                ['monthly', 'Per month', selectedRates.pricePerMonth],
              ] as const).map(([mode, label, amount]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      pricingMode: mode,
                      duration: mode === 'hourly' ? 24 : 1,
                    }))
                  }
                  className={`rounded-lg border px-2.5 py-2 text-left ${
                    form.pricingMode === mode
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                      : 'border-gray-200 bg-gray-50 hover:border-primary-300'
                  }`}
                >
                  <p className="text-[11px] font-medium text-gray-500">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">{formatPrice(amount)}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{DURATION_LABEL[form.pricingMode]}</label>
            <input
              type="number"
              min={1}
              value={form.duration}
              onChange={(e) => setForm((f) => ({ ...f, duration: parseInt(e.target.value, 10) || 1 }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
            />
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
          <div className="mt-4 rounded-lg border border-gray-200 bg-white shadow">
            <table className="w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Placement</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 md:table-cell">Period</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {ads.map((ad) => (
                  <tr key={ad._id}>
                    <td className="px-3 py-3 text-sm text-gray-900 sm:px-4 break-words">{getAdPlacementLabel(ad.placement)}</td>
                    <td className="hidden px-4 py-3 text-sm text-gray-600 md:table-cell">
                      {new Date(ad.startDate).toLocaleString()} – {new Date(ad.endDate).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 sm:px-4">
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
                    <td className="px-3 py-3 sm:px-4">
                      {!ad.paymentId && ad.status === 'pending_approval' && (
                        <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                          <button
                            type="button"
                            onClick={() => startPayment(ad._id, 'wallet')}
                            disabled={!!payingAdId}
                            className="text-sm font-medium text-emerald-700 hover:underline"
                          >
                            Pay (Ad credit)
                          </button>
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
