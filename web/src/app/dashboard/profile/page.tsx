'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.name != null) setName(d.name);
        if (d.phone != null) setPhone(d.phone);
        if (d.image != null) setImage(d.image);
        if (d.email != null) setEmail(d.email);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, image }),
      });
      if (res.ok) setMessage('success');
      else setMessage('error');
    } catch {
      setMessage('error');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div>
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
      <p className="mt-1 text-sm text-gray-500">Your picture, name and contact details. Used as fallback contact on listings without an agent.</p>
      <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Profile picture URL</label>
          <input
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://..."
            className="input mt-1 w-full"
          />
          {image && (
            <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-full bg-gray-100">
              <Image src={image} alt="Profile" fill className="object-cover" unoptimized />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input mt-1 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" value={email} disabled className="input mt-1 w-full bg-gray-50" />
          <p className="mt-1 text-xs text-gray-500">Email cannot be changed here.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+234..."
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-xs text-gray-500">Used as contact fallback on your listings when no agent is set.</p>
        </div>
        {message === 'success' && <p className="text-sm text-green-600">Profile updated.</p>}
        {message === 'error' && <p className="text-sm text-red-600">Update failed. Try again.</p>}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
      <p className="mt-6">
        <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">← Dashboard</Link>
      </p>
    </div>
  );
}
