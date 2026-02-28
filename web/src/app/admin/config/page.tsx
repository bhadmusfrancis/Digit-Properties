'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type TierConfig = {
  tier: string;
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  maxFeatured: number;
  maxHighlighted: number;
  priceMonthly: number;
};

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<TierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/config/subscription')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setConfigs(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <div>
                <label className="block text-xs font-medium text-gray-500">Price (NGN/mo)</label>
                <input
                  type="number"
                  min={0}
                  value={c.priceMonthly ?? 0}
                  onChange={(e) => updateTier(c.tier, { priceMonthly: parseInt(e.target.value, 10) || 0 })}
                  className="input mt-1"
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
                  className="input mt-1"
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
                  className="input mt-1"
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
                  className="input mt-1"
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
                  className="input mt-1"
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
                  className="input mt-1"
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
      <p className="mt-6">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}
