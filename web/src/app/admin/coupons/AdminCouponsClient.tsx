'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatPrice } from '@/lib/utils';

type Coupon = {
  _id: string;
  code: string;
  amount: number;
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt?: string | null;
  active: boolean;
  description?: string;
  createdAt: string;
};

const emptyForm = {
  code: '',
  amount: 1000,
  maxRedemptions: 100,
  expiresAt: '',
  description: '',
};

export default function AdminCouponsClient() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/coupons')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setCoupons(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const active = coupons.filter((c) => c.active).length;
    const totalIssued = coupons.reduce(
      (acc, c) => acc + c.amount * c.maxRedemptions,
      0
    );
    const totalRedeemed = coupons.reduce(
      (acc, c) => acc + c.amount * c.redeemedCount,
      0
    );
    return { active, totalIssued, totalRedeemed };
  }, [coupons]);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedCode(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim() || undefined,
          amount: Number(form.amount),
          maxRedemptions: Number(form.maxRedemptions),
          expiresAt: form.expiresAt || undefined,
          description: form.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setForm(emptyForm);
      setCreatedCode(data.code);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (c: Coupon) => {
    const res = await fetch(`/api/admin/coupons/${c._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    });
    if (res.ok) load();
  };

  const deleteCoupon = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/coupons/${c._id}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Coupon codes</h2>
          <p className="mt-1 text-sm text-gray-500">
            Create coupons that credit users' Ad credit wallets when redeemed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm);
            setError(null);
            setCreatedCode(null);
          }}
          className="min-h-[44px] rounded bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          {showForm ? 'Cancel' : 'New coupon'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Active coupons</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totals.active}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Total face value</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatPrice(totals.totalIssued)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Already redeemed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{formatPrice(totals.totalRedeemed)}</p>
        </div>
      </div>

      {createdCode && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="text-emerald-900">
            Coupon created. Share this code with eligible users:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-white px-3 py-1.5 font-mono text-base font-bold tracking-widest text-emerald-900 shadow-sm">
              {createdCode}
            </code>
            <button
              type="button"
              onClick={() => copyCode(createdCode)}
              className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form
          onSubmit={submitCreate}
          className="mt-4 max-w-2xl space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Code (leave blank to auto-generate)
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. WELCOME2026"
                maxLength={32}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono uppercase tracking-wider"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Amount per redemption (NGN)
              <input
                type="number"
                min={1}
                step={100}
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Max redemptions (number of users)
              <input
                type="number"
                min={1}
                step={1}
                required
                value={form.maxRedemptions}
                onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Expires at (optional)
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Description (internal note)
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={200}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] rounded bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create coupon'}
          </button>
        </form>
      )}

      <div className="mt-6 overflow-x-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Code</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Amount</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Used / Max</th>
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Expires</th>
              <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500 sm:px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {coupons.map((c) => {
              const expired = !!c.expiresAt && new Date(c.expiresAt) < new Date();
              const exhausted = c.redeemedCount >= c.maxRedemptions;
              return (
                <tr key={c._id}>
                  <td className="px-3 py-3 text-sm sm:px-4">
                    <button
                      type="button"
                      onClick={() => copyCode(c.code)}
                      className="rounded bg-gray-100 px-2 py-1 font-mono text-xs font-bold tracking-wider text-gray-900 hover:bg-gray-200"
                      title="Click to copy"
                    >
                      {c.code}
                    </button>
                    {c.description && (
                      <p className="mt-1 text-xs text-gray-500">{c.description}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-900 sm:px-4">{formatPrice(c.amount)}</td>
                  <td className="px-3 py-3 text-sm text-gray-700 sm:px-4">
                    {c.redeemedCount} / {c.maxRedemptions}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-NG') : '—'}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3">
                    {!c.active ? (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">Inactive</span>
                    ) : expired ? (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">Expired</span>
                    ) : exhausted ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Exhausted</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">Active</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right sm:px-4">
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      {c.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <span className="text-gray-300 mx-2">|</span>
                    <button
                      type="button"
                      onClick={() => deleteCoupon(c)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && coupons.length === 0 && (
          <div className="py-12 text-center text-gray-500">No coupons yet. Create one above.</div>
        )}
        {loading && <div className="py-12 text-center text-gray-500">Loading…</div>}
      </div>

      <p className="mt-4">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}
