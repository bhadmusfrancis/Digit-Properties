'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { USER_ROLES } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';

type Role = (typeof USER_ROLES)[keyof typeof USER_ROLES];

type User = {
  _id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  subscriptionTier?: string;
  createdAt?: string;
};

const defaultForm = { name: '', email: '', password: '', role: USER_ROLES.GUEST as Role, phone: '' };

export default function AdminUsersPageClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<typeof defaultForm>(defaultForm);
  const [crediting, setCrediting] = useState<User | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditAmount, setCreditAmount] = useState<number | ''>(1000);
  const [creditAction, setCreditAction] = useState<'credit' | 'debit'>('credit');
  const [creditDescription, setCreditDescription] = useState('');
  const [creditSubmitting, setCreditSubmitting] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [creditSuccess, setCreditSuccess] = useState<string | null>(null);

  const load = () => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setUsers(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const createUser = (e: React.FormEvent) => {
    e.preventDefault();
    fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then((r) => {
        if (r.ok) {
          setShowAdd(false);
          setForm(defaultForm);
          load();
        } else return r.json().then((d) => alert(d.error || 'Failed'));
      })
      .catch(() => alert('Failed'));
  };

  const updateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    fetch(`/api/admin/users/${editing._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      }),
    })
      .then((r) => {
        if (r.ok) {
          setEditing(null);
          setForm(defaultForm);
          load();
        } else return r.json().then((d) => alert(d.error || 'Failed'));
      })
      .catch(() => alert('Failed'));
  };

  const deleteUser = (id: string) => {
    if (!confirm('Delete this user?')) return;
    fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      .then((r) => {
        if (r.ok) load();
        else r.json().then((d) => alert(d.error || 'Failed'));
      })
      .catch(() => alert('Failed'));
  };

  const startEdit = (u: User) => {
    setEditing(u);
    const role: Role = u.role && Object.values(USER_ROLES).includes(u.role as Role) ? (u.role as Role) : USER_ROLES.GUEST;
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role,
      phone: u.phone || '',
    });
  };

  const startCredit = (u: User) => {
    setCrediting(u);
    setCreditBalance(null);
    setCreditAmount(1000);
    setCreditAction('credit');
    setCreditDescription('');
    setCreditError(null);
    setCreditSuccess(null);
    fetch(`/api/admin/users/${u._id}/credit`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.balance === 'number') setCreditBalance(d.balance);
      })
      .catch(() => {});
  };

  const submitCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crediting) return;
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCreditError('Enter a positive amount.');
      return;
    }
    setCreditSubmitting(true);
    setCreditError(null);
    setCreditSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${crediting._id}/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          action: creditAction,
          description: creditDescription || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCreditBalance(data.balance);
      setCreditSuccess(
        `${creditAction === 'credit' ? 'Credited' : 'Debited'} ${formatPrice(amount)}. New balance: ${formatPrice(data.balance)}.`
      );
      setCreditAmount('');
    } catch (err) {
      setCreditError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreditSubmitting(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading users...</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Users</h2>
      <p className="mt-1 text-sm text-gray-500">{users.length} users</p>
      <button
        type="button"
        onClick={() => setShowAdd(!showAdd)}
        className="mt-4 min-h-[44px] w-full sm:w-auto rounded bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 touch-manipulation"
      >
        {showAdd ? 'Cancel' : 'Add user'}
      </button>
      {showAdd && (
        <form onSubmit={createUser} className="mt-4 max-w-md rounded-lg border border-gray-200 bg-gray-50 p-4">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input mb-2 w-full"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="input mb-2 w-full"
          />
          <input
            type="password"
            placeholder="Password (optional)"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="input mb-2 w-full"
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="input mb-2 w-full"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            className="input mb-2 w-full"
          >
            {Object.values(USER_ROLES).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}
      {editing && (
        <form onSubmit={updateUser} className="mt-4 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 font-medium">Edit {editing.email}</p>
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input mb-2 w-full"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="input mb-2 w-full"
          />
          <input
            type="password"
            placeholder="New password (leave blank to keep)"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="input mb-2 w-full"
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="input mb-2 w-full"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            className="input mb-2 w-full"
          >
            {Object.values(USER_ROLES).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}
      {crediting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCrediting(null)}>
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Adjust wallet</h3>
                <p className="mt-0.5 text-sm text-gray-600">{crediting.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setCrediting(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              Current balance:{' '}
              <span className="font-semibold text-gray-900">
                {creditBalance === null ? 'Loading…' : formatPrice(creditBalance)}
              </span>
            </p>
            <form onSubmit={submitCredit} className="mt-4 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreditAction('credit')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                    creditAction === 'credit'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-gray-300 text-gray-700 hover:border-emerald-300'
                  }`}
                >
                  Credit
                </button>
                <button
                  type="button"
                  onClick={() => setCreditAction('debit')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                    creditAction === 'debit'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-gray-300 text-gray-700 hover:border-amber-300'
                  }`}
                >
                  Debit
                </button>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Amount (NGN)
                <input
                  type="number"
                  min={1}
                  step={100}
                  required
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Reason / note (optional)
                <input
                  value={creditDescription}
                  onChange={(e) => setCreditDescription(e.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="e.g. Promo, refund, manual top-up"
                />
              </label>
              {creditError && (
                <p className="rounded bg-red-50 p-2 text-sm text-red-700">{creditError}</p>
              )}
              {creditSuccess && (
                <p className="rounded bg-green-50 p-2 text-sm text-green-700">{creditSuccess}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creditSubmitting}
                  className={`flex-1 min-h-[44px] rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                    creditAction === 'credit'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {creditSubmitting ? 'Processing…' : creditAction === 'credit' ? 'Credit wallet' : 'Debit wallet'}
                </button>
                <button
                  type="button"
                  onClick={() => setCrediting(null)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-x-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Name</th>
              <th className="hidden sm:table-cell px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Email</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">Role</th>
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tier</th>
              <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500 sm:px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.map((u) => (
              <tr key={u._id}>
                <td className="px-3 py-3 text-sm font-medium text-gray-900 max-w-[120px] sm:max-w-none truncate sm:whitespace-normal" title={u.name}>{u.name}</td>
                <td className="hidden sm:table-cell px-3 py-3 text-sm text-gray-600 truncate" title={u.email}>{u.email}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">{u.role}</span>
                </td>
                <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600">{u.subscriptionTier || '—'}</td>
                <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-600">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-NG') : '—'}
                </td>
                <td className="px-3 py-3 text-right">
                  <button type="button" onClick={() => startEdit(u)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-primary-600 hover:underline py-1 px-2 -m-1 rounded touch-manipulation">Edit</button>
                  <span className="text-gray-300 mx-1">|</span>
                  <button type="button" onClick={() => startCredit(u)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-emerald-700 hover:underline py-1 px-2 -m-1 rounded touch-manipulation">Credit</button>
                  <span className="text-gray-300 mx-1">|</span>
                  <button type="button" onClick={() => deleteUser(u._id)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-red-600 hover:underline py-1 px-2 -m-1 rounded touch-manipulation">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div className="py-12 text-center text-gray-500">No users yet.</div>}
      </div>
      <p className="mt-4">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}
