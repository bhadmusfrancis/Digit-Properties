'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AD_PLACEMENTS } from '@/lib/constants';
import { AD_PLACEMENT_LABELS, resolvePlacementRates } from '@/lib/ad-placements';
import { BOOST_PACKAGES, type BoostPackage } from '@/lib/boost-packages';

type TierConfig = {
  tier: string;
  label?: string;
  boostDays?: number;
  maxListings: number;
  maxImages: number;
  maxVideos: number;
  canFeatured: boolean;
  canHighlighted: boolean;
  maxCategories: number;
  priceMonthly: number;
};

type PlacementPricing = {
  pricePerDay: number;
  pricePerHour: number;
  pricePerWeek: number;
  pricePerMonth: number;
  currency: string;
};
type AdConfigState = {
  placementPricing: Record<string, PlacementPricing>;
  adsense: Record<string, string>;
  adsterra: Record<string, string>;
  adsenseEnabled: boolean;
};

type ListingModerationState = {
  newListingsRequireApproval: boolean;
  editedListingsRequireApproval: boolean;
};

const PLACEMENT_LABELS = AD_PLACEMENT_LABELS;

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<TierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adConfig, setAdConfig] = useState<AdConfigState | null>(null);
  const [adConfigLoading, setAdConfigLoading] = useState(true);
  const [adConfigSaving, setAdConfigSaving] = useState(false);
  const [adConfigError, setAdConfigError] = useState<string | null>(null);
  const [listingMod, setListingMod] = useState<ListingModerationState | null>(null);
  const [listingModLoading, setListingModLoading] = useState(true);
  const [listingModSaving, setListingModSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/config/listing-moderation')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.newListingsRequireApproval === 'boolean' && typeof d?.editedListingsRequireApproval === 'boolean') {
          setListingMod({
            newListingsRequireApproval: d.newListingsRequireApproval,
            editedListingsRequireApproval: d.editedListingsRequireApproval,
          });
        }
      })
      .catch(() => {})
      .finally(() => setListingModLoading(false));
  }, []);

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
          pricing[p] = resolvePlacementRates(
            d.placementPricing?.[p] ?? {
              pricePerDay: 5000,
              pricePerHour: 500,
              pricePerWeek: 30000,
              pricePerMonth: 100000,
              currency: 'NGN',
            }
          );
        });
        setAdConfig({
          placementPricing: pricing,
          adsense: d.adsense || {},
          adsterra: d.adsterra || {},
          adsenseEnabled: d.adsenseEnabled !== false,
        });
      })
      .catch(() =>
        setAdConfig({
          placementPricing: Object.fromEntries(
            AD_PLACEMENTS.map((p) => [
              p,
              { pricePerDay: 5000, pricePerHour: 500, pricePerWeek: 30000, pricePerMonth: 100000, currency: 'NGN' },
            ])
          ),
          adsense: {},
          adsterra: {},
          adsenseEnabled: true,
        })
      )
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
        <p className="text-gray-500">Loading boost package config...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Listing boost packages</h2>
      <p className="mt-1 text-sm text-gray-500">
        Configure Starter, Pro, and Premium boost packages: price per boost, duration, media limits, and Featured / Highlighted access. Pro includes Facebook and Instagram posting; Premium includes Facebook, Instagram, and X. Shown on listing plans and used when users boost a property.
      </p>
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="font-medium text-gray-900">Listing moderation</h3>
        <p className="mt-1 text-sm text-gray-500">
          Control whether non-admin submissions go live immediately or wait in pending approval (Admin → Listings). Admins and
          the bot role are not subject to the new-listing gate.
        </p>
        {listingModLoading ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : listingMod ? (
          <div className="mt-4 space-y-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={listingMod.newListingsRequireApproval}
                onChange={(e) => setListingMod((m) => (m ? { ...m, newListingsRequireApproval: e.target.checked } : m))}
                disabled={listingModSaving}
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600"
              />
              <span>
                <span className="font-medium text-gray-800">New listings require approval before going live</span>
                <span className="mt-0.5 block text-sm text-gray-500">
                  When someone publishes a new property (wizard, form, or “activate” from draft), set status to pending until an admin activates it.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={listingMod.editedListingsRequireApproval}
                onChange={(e) => setListingMod((m) => (m ? { ...m, editedListingsRequireApproval: e.target.checked } : m))}
                disabled={listingModSaving}
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600"
              />
              <span>
                <span className="font-medium text-gray-800">Edits to live listings require re-approval</span>
                <span className="mt-0.5 block text-sm text-gray-500">
                  When unchecked, owners can change an active listing and it stays live without going back to pending.
                </span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                if (!listingMod) return;
                setListingModSaving(true);
                fetch('/api/admin/config/listing-moderation', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(listingMod),
                })
                  .then((r) => r.json())
                  .then((d) => {
                    if (typeof d?.newListingsRequireApproval === 'boolean' && typeof d?.editedListingsRequireApproval === 'boolean') {
                      setListingMod({
                        newListingsRequireApproval: d.newListingsRequireApproval,
                        editedListingsRequireApproval: d.editedListingsRequireApproval,
                      });
                    }
                  })
                  .finally(() => setListingModSaving(false));
              }}
              disabled={listingModSaving}
              className="btn bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {listingModSaving ? 'Saving…' : 'Save moderation settings'}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-700">Could not load moderation settings. Refresh or try again.</p>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {configs.map((c) => (
          <div key={c.tier} className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="font-medium text-gray-900">
              {c.label ?? c.tier.charAt(0).toUpperCase() + c.tier.slice(1)}
              {c.boostDays != null ? (
                <span className="ml-2 text-sm font-normal text-gray-500">({c.boostDays} days per boost)</span>
              ) : null}
            </h3>
            <div className="mt-4 grid gap-4 grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <div>
                <label className="block text-xs font-medium text-gray-500">Price (NGN per boost)</label>
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
            {(() => {
              const pkg = BOOST_PACKAGES[c.tier as BoostPackage['id']];
              if (!pkg) return null;
              return (
                <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2 text-sm text-sky-950">
                  <p className="font-medium">Social posting</p>
                  <p className="mt-0.5 text-sky-800">
                    {pkg.socialFacebook && pkg.socialTwitter
                      ? 'Facebook, Instagram, and X posting included after Boost Post Now.'
                      : pkg.socialFacebook
                        ? 'Facebook and Instagram posting included after Boost Post Now.'
                        : pkg.socialTwitter
                          ? 'X posting included after Boost Post Now.'
                          : 'On-site boost only. No Facebook, Instagram, or X posting.'}
                  </p>
                </div>
              );
            })()}
            {saving === c.tier && (
              <p className="mt-2 text-sm text-gray-500">Saving...</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-10 border-t border-gray-200 pt-10">
        <h2 className="text-lg font-semibold text-gray-900">Ad placement pricing, AdSense &amp; Adsterra</h2>
        <p className="mt-1 text-sm text-gray-500">
          Price per hour, day, week, and month for each placement. Paste AdSense and/or Adsterra Native Banner code (HTML snippet) per slot to show ads when no user ad is selected. Use Adsterra as an optional alternative to AdSense.
        </p>
        {adConfigLoading ? (
          <p className="mt-4 text-gray-500">Loading ad config…</p>
        ) : adConfig ? (
          <div className="mt-6 space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="font-medium text-gray-900">AdSense</h3>
              <p className="mt-1 text-sm text-gray-500">
                Turn the sitewide AdSense script and all placement snippets on or off. Snippets are kept when off so you can
                re-enable them later.
              </p>
              <label className="mt-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={adConfig.adsenseEnabled}
                  onChange={(e) => setAdConfig((c) => (c ? { ...c, adsenseEnabled: e.target.checked } : c))}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm font-medium text-gray-800">
                  {adConfig.adsenseEnabled ? 'AdSense is ON' : 'AdSense is OFF'}
                </span>
              </label>
            </div>
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
                          [p]: { ...(c!.placementPricing[p] || { pricePerDay: 0, pricePerHour: 0, pricePerWeek: 0, pricePerMonth: 0, currency: 'NGN' }), pricePerDay: parseInt(e.target.value, 10) || 0 },
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
                          [p]: { ...(c!.placementPricing[p] || { pricePerDay: 0, pricePerHour: 0, pricePerWeek: 0, pricePerMonth: 0, currency: 'NGN' }), pricePerHour: parseInt(e.target.value, 10) || 0 },
                        },
                      }))}
                      className="input mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Price per week (NGN)</label>
                    <input
                      type="number"
                      min={0}
                      value={adConfig.placementPricing?.[p]?.pricePerWeek ?? 0}
                      onChange={(e) => setAdConfig((c) => ({
                        ...c!,
                        placementPricing: {
                          ...c!.placementPricing,
                          [p]: { ...(c!.placementPricing[p] || { pricePerDay: 0, pricePerHour: 0, pricePerWeek: 0, pricePerMonth: 0, currency: 'NGN' }), pricePerWeek: parseInt(e.target.value, 10) || 0 },
                        },
                      }))}
                      className="input mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Price per month (NGN)</label>
                    <input
                      type="number"
                      min={0}
                      value={adConfig.placementPricing?.[p]?.pricePerMonth ?? 0}
                      onChange={(e) => setAdConfig((c) => ({
                        ...c!,
                        placementPricing: {
                          ...c!.placementPricing,
                          [p]: { ...(c!.placementPricing[p] || { pricePerDay: 0, pricePerHour: 0, pricePerWeek: 0, pricePerMonth: 0, currency: 'NGN' }), pricePerMonth: parseInt(e.target.value, 10) || 0 },
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
                    placeholder="Paste AdSense <ins class=&quot;adsbygoogle&quot;> + (adsbygoogle).push({})"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Create a Display ad unit in AdSense, then paste the full snippet here and click Save. Without a saved snippet this slot cannot show manual AdSense.
                  </p>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-500">
                    Adsterra Native Banner (HTML snippet, optional)
                  </label>
                  <textarea
                    rows={3}
                    value={adConfig.adsterra?.[p] ?? ''}
                    onChange={(e) => setAdConfig((c) => ({
                      ...c!,
                      adsterra: { ...c!.adsterra, [p]: e.target.value },
                    }))}
                    className="input mt-1 w-full font-mono text-sm"
                    placeholder="Paste Adsterra invoke.js script + container div..."
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Paste both the <code>&lt;script&gt;</code> and the <code>&lt;div id=&quot;container-…&quot;&gt;</code>. Scripts are executed on render. When AdSense/Adsterra is set, Featured slots prefer network ads (~70%) over featured listings so units are not drowned out.
                  </p>
                </div>
              </div>
            ))}
            {adConfigError ? <p className="text-sm text-red-600">{adConfigError}</p> : null}
            <button
              type="button"
              onClick={() => {
                setAdConfigSaving(true);
                setAdConfigError(null);
                fetch('/api/admin/config/ads', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(adConfig),
                })
                  .then(async (r) => {
                    const d = await r.json().catch(() => null);
                    if (!r.ok || !d?.placementPricing) {
                      throw new Error(typeof d?.error === 'string' ? d.error : 'Failed to save ad config');
                    }
                    setAdConfig({
                      placementPricing: d.placementPricing,
                      adsense: d.adsense || {},
                      adsterra: d.adsterra || {},
                      adsenseEnabled: d.adsenseEnabled !== false,
                    });
                  })
                  .catch((err: unknown) => {
                    setAdConfigError(err instanceof Error ? err.message : 'Failed to save ad config');
                  })
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
