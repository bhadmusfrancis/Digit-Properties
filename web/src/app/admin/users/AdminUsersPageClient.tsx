'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { USER_ROLES } from '@/lib/constants';

type User = {
  _id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  subscriptionTier?: string;
  createdAt?: string;
};

export default function AdminUsersPageClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: USER_ROLES.GUEST, phone: '' });

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
          setForm({ name: '', email: '', password: '', role: USER_ROLES.GUEST, phone: '' });
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
          setForm({ name: '', email: '', password: '', role: USER_ROLES.GUEST, phone: '' });
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
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: (u.role as string) || USER_ROLES.GUEST,
      phone: u.phone || '',
    });
  };

  if (loading) return <p className="text-gray-500">Loading users...</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Users</h2>
      <p className="mt-1 text-sm text-gray-500">{users.length} users</p>
      <button
        type="button"
        onClick={() => setShowAdd(!showAdd)}
        className="mt-4 rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
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
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
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
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
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
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.map((u) => (
              <tr key={u._id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">{u.role}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.subscriptionTier || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-NG') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => startEdit(u)} className="text-primary-600 hover:underline">Edit</button>
                  {' · '}
                  <button type="button" onClick={() => deleteUser(u._id)} className="text-red-600 hover:underline">Delete</button>
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
