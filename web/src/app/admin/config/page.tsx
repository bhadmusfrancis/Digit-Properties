'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AD_PLACEMENTS } from '@/lib/constants';

type TierConfig = {
  tier: string;
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  maxCategories: number;
  maxFeatured: number;
  maxHighlighted: number;
  priceMonthly: number;
};

type PlacementPricing = { pricePerDay: number; pricePerHour: number; currency: string };
type AdConfigState = {
  placementPricing: Record<string, PlacementPricing>;
  adsense: Record<string, string>;
};

const PLACEMENT_LABELS: Record<string, string> = {
  home_featured: 'Homepage featured',
  search: 'Search page',
  listings: 'Listings page',
};

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<TierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adConfig, setAdConfig] = useState<AdConfigState | null>(null);
  const [adConfigLoading, setAdConfigLoading] = useState(true);
  const [adConfigSaving, setAdConfigSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/config/subscription')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setConfigs(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/admin/config/ads')
      .then((r) => r.json())
      .then((d) => {
        const pricing: Record<string, PlacementPricing> = {};
        AD_PLACEMENTS.forEach((p) => {
          pricing[p] = d.placementPricing?.[p] ?? { pricePerDay: 5000, pricePerHour: 500, currency: 'NGN' };
        });
        setAdConfig({ placementPricing: pricing, adsense: d.adsense || {} });
      })
      .catch(() => setAdConfig({ placementPricing: Object.fromEntries(AD_PLACEMENTS.map((p) => [p, { pricePerDay: 5000, pricePerHour: 500, currency: 'NGN' }])), adsense: {} }))
      .finally(() => setAdConfigLoading(false));
  }, []);

  const updateTier = (tier: string, data: Partial<TierConfig>) => {
    const current = configs.find((c) => c.tier === tier);
    if (!current) return;
    setSaving(tier);
    fetch('/api/admin/config/subscription', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...current, ...data }),
    })
      .then((r) => r.ok && fetch('/api/admin/config/subscription').then((r2) => r2.json()))
      .then((d) => {
        if (Array.isArray(d)) setConfigs(d);
      })
      .finally(() => setSaving(null));
  };

  if (loading) {
    return (
      <div>
        <p className="text-gray-500">Loading subscription config...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Subscription & listing config</h2>
      <p className="mt-1 text-sm text-gray-500">
        Set per tier: price (NGN/month), max listings, images/videos per listing, max Featured & Highlighted slots. Shown on the new listing page.
      </p>
      <div className="mt-6 space-y-6">
        {configs.map((c) => (
          <div key={c.tier} className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="font-medium text-gray-900 capitalize">{c.tier === 'guest' ? 'Guest / Free' : c.tier}</h3>
            <div className="mt-4 grid gap-4 grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
              <div>
                <label className="block text-xs font-medium text-gray-500">Price (NGN/mo)</label>
                <input
                  type="number"
                  min={0}
                  value={c.priceMonthly ?? 0}
                  onChange={(e) => updateTier(c.tier, { priceMonthly: parseInt(e.target.value, 10) || 0 })}
                  className="input mt-1 w-full"
                  disabled={!!saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Max listings</label>
                <input
                  type="number"
                  min={1}
                  value={c.maxListings}
                  onChange={(e) => updateTier(c.tier, { maxListings: parseInt(e.target.value, 10) || 1 })}
                  className="input mt-1 w-full"
                  disabled={!!saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Max images</label>
                <input
                  type="number"
                  min={1}
                  value={c.maxImages}
                  onChange={(e) => updateTier(c.tier, { maxImages: parseInt(e.target.value, 10) || 1 })}
                  className="input mt-1 w-full"
                  disabled={!!saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Max videos</label>
                <input
                  type="number"
                  min={0}
                  value={c.maxVideos}
                  onChange={(e) => updateTier(c.tier, { maxVideos: parseInt(e.target.value, 10) || 0 })}
                  className="input mt-1 w-full"
                  disabled={!!saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Category slots</label>
                <input
                  type="number"
                  min={1}
                  value={c.maxCategories ?? 1}
                  onChange={(e) => updateTier(c.tier, { maxCategories: parseInt(e.target.value, 10) || 1 })}
                  className="input mt-1 w-full"
                  disabled={!!saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Max Featured</label>
                <input
                  type="number"
                  min={0}
                  value={c.maxFeatured ?? 0}
                  onChange={(e) => updateTier(c.tier, { maxFeatured: parseInt(e.target.value, 10) || 0 })}
                  className="input mt-1 w-full"
                  disabled={!!saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Max Highlighted</label>
                <input
                  type="number"
                  min={0}
                  value={c.maxHighlighted ?? 0}
                  onChange={(e) => updateTier(c.tier, { maxHighlighted: parseInt(e.target.value, 10) || 0 })}
                  className="input mt-1 w-full"
                  disabled={!!saving}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.canFeatured}
                    onChange={(e) => updateTier(c.tier, { canFeatured: e.target.checked })}
                    disabled={!!saving}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  <span className="text-sm text-gray-700">Featured (carousel)</span>
                </label>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.canHighlighted}
                    onChange={(e) => updateTier(c.tier, { canHighlighted: e.target.checked })}
                    disabled={!!saving}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  <span className="text-sm text-gray-700">Highlighted (search)</span>
                </label>
              </div>
            </div>
            {saving === c.tier && (
              <p className="mt-2 text-sm text-gray-500">Saving...</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-10 border-t border-gray-200 pt-10">
        <h2 className="text-lg font-semibold text-gray-900">Ad placement pricing &amp; AdSense</h2>
        <p className="mt-1 text-sm text-gray-500">
          Price per day/hour for each placement. Paste AdSense code (HTML snippet) per slot to show ads when no user ad is selected.
        </p>
        {adConfigLoading ? (
          <p className="mt-4 text-gray-500">Loading ad config…</p>
        ) : adConfig ? (
          <div className="mt-6 space-y-6">
            {AD_PLACEMENTS.map((p) => (
              <div key={p} className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="font-medium text-gray-900">{PLACEMENT_LABELS[p] ?? p}</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Price per day (NGN)</label>
                    <input
                      type="number"
                      min={0}
                      value={adConfig.placementPricing?.[p]?.pricePerDay ?? 0}
                      onChange={(e) => setAdConfig((c) => ({
                        ...c!,
                        placementPricing: {
                          ...c!.placementPricing,
                          [p]: { ...(c!.placementPricing[p] || { currency: 'NGN' }), pricePerDay: parseInt(e.target.value, 10) || 0 },
                        },
                      }))}
                      className="input mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Price per hour (NGN)</label>
                    <input
                      type="number"
                      min={0}
                      value={adConfig.placementPricing?.[p]?.pricePerHour ?? 0}
                      onChange={(e) => setAdConfig((c) => ({
                        ...c!,
                        placementPricing: {
                          ...c!.placementPricing,
                          [p]: { ...(c!.placementPricing[p] || { currency: 'NGN' }), pricePerHour: parseInt(e.target.value, 10) || 0 },
                        },
                      }))}
                      className="input mt-1 w-full"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-500">AdSense code (HTML snippet, optional)</label>
                  <textarea
                    rows={3}
                    value={adConfig.adsense?.[p] ?? ''}
                    onChange={(e) => setAdConfig((c) => ({
                      ...c!,
                      adsense: { ...c!.adsense, [p]: e.target.value },
                    }))}
                    className="input mt-1 w-full font-mono text-sm"
                    placeholder="Paste AdSense ins + script block..."
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setAdConfigSaving(true);
                fetch('/api/admin/config/ads', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(adConfig),
                })
                  .then((r) => r.ok && r.json())
                  .then((d) => d && setAdConfig({ placementPricing: d.placementPricing || {}, adsense: d.adsense || {} }))
                  .finally(() => setAdConfigSaving(false));
              }}
              disabled={adConfigSaving}
              className="btn bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {adConfigSaving ? 'Saving…' : 'Save ad config'}
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-6">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}
