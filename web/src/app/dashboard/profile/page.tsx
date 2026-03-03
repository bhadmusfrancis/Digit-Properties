'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LivenessCamera } from '@/components/verification/LivenessCamera';

type UserMe = {
  name: string;
  email: string;
  phone?: string;
  image?: string;
  role?: string;
  companyPosition?: string;
  phoneVerifiedAt?: string;
  livenessVerifiedAt?: string;
  canChangeProfilePicture?: boolean;
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState('');
  const [email, setEmail] = useState('');
  const [companyPosition, setCompanyPosition] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<'success' | 'error' | null>(null);
  const [livenessUploading, setLivenessUploading] = useState(false);
  const [livenessMessage, setLivenessMessage] = useState<string | null>(null);
  const [showLivenessCamera, setShowLivenessCamera] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        setUser(d);
        if (d.name != null) setName(d.name);
        if (d.phone != null) setPhone(d.phone);
        if (d.image != null) setImage(d.image);
        if (d.email != null) setEmail(d.email);
        if (d.companyPosition != null) setCompanyPosition(d.companyPosition);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const body: { name: string; phone?: string; image?: string; companyPosition?: string } = {
        name,
        phone: phone || undefined,
      };
      if (user?.canChangeProfilePicture && image) body.image = image;
      if (
        (user?.role === 'registered_agent' || user?.role === 'registered_developer') &&
        companyPosition !== undefined
      ) {
        body.companyPosition = companyPosition.trim() || undefined;
      }
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMessage('success');
        const data = await res.json();
        setUser((u) => (u ? { ...u, ...data } : null));
      } else {
        const data = await res.json();
        setMessage(data.error || 'error');
      }
    } catch {
      setMessage('error');
    }
    setSaving(false);
  }

  async function handleLivenessSuccess(imageUrl: string) {
    setLivenessUploading(true);
    setLivenessMessage(null);
    setShowLivenessCamera(false);
    try {
      const res = await fetch('/api/me/liveness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setLivenessMessage('Liveness verified. This is now your profile picture.');
        setImage(imageUrl);
        setUser((u) =>
          u
            ? {
                ...u,
                image: imageUrl,
                livenessVerifiedAt: new Date().toISOString(),
                canChangeProfilePicture: false,
              }
            : null
        );
      } else {
        setLivenessMessage(data.error || 'Verification failed');
      }
    } catch {
      setLivenessMessage('Request failed');
    }
    setLivenessUploading(false);
  }

  if (loading || !user) {
    return (
      <div>
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  const canChangePicture = user.canChangeProfilePicture === true;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
      <p className="mt-1 text-sm text-gray-500">
        Your picture, name and contact details. Used as fallback contact on listings without an
        agent.
      </p>
      <p className="mt-2 text-sm">
        <Link href="/dashboard/verification" className="text-primary-600 hover:underline">
          Verification status & role upgrade →
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Profile picture</label>
          {!canChangePicture && user.livenessVerifiedAt && (
            <p className="mt-1 text-xs text-amber-700">
              Profile picture is set from liveness verification. You can change it after becoming a
              Registered Agent or Developer.
            </p>
          )}
          {canChangePicture && (
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
              className="input mt-1 w-full"
            />
          )}
          {image && (
            <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-full bg-gray-100">
              <Image src={image} alt="Profile" fill className="object-cover" unoptimized />
            </div>
          )}
        </div>

        {!user.livenessVerifiedAt && user.role !== 'admin' && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-medium text-gray-900">Complete liveness (face verification)</h3>
            <p className="mt-1 text-xs text-gray-500">
              Identity verification uses your device camera only. Centre your face in the oval, then
              blink, turn your head, and smile. The captured photo will be your profile picture until
              you become a Registered Agent or Developer.
            </p>
            {!showLivenessCamera ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowLivenessCamera(true)}
                  disabled={livenessUploading}
                  className="btn-primary mt-3"
                >
                  {livenessUploading ? 'Verifying…' : 'Verify with camera'}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Liveness must be completed with your device camera for security. Good lighting helps.
                </p>
              </>
            ) : (
              <div className="mt-4">
                <LivenessCamera
                  onSuccess={handleLivenessSuccess}
                  onCancel={() => setShowLivenessCamera(false)}
                  onError={(msg) => setLivenessMessage(msg)}
                  isUploading={livenessUploading}
                />
              </div>
            )}
            {livenessMessage && (
              <p className="mt-2 text-sm text-gray-700">{livenessMessage}</p>
            )}
          </div>
        )}

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
          {user.phoneVerifiedAt ? (
            <p className="mt-1 text-xs text-green-600">Phone verified</p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Verify on <Link href="/dashboard/verification" className="text-primary-600 underline">Verification</Link>.
            </p>
          )}
        </div>
        {(user.role === 'registered_agent' || user.role === 'registered_developer') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Position in company</label>
            <input
              type="text"
              value={companyPosition}
              onChange={(e) => setCompanyPosition(e.target.value)}
              placeholder="e.g. Agent, Director"
              className="input mt-1 w-full"
            />
          </div>
        )}
        {message === 'success' && <p className="text-sm text-green-600">Profile updated.</p>}
        {(message === 'error' || (message && message !== 'success')) && (
          <p className="text-sm text-red-600">{message}</p>
        )}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
      <p className="mt-6">
        <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">
          ← Dashboard
        </Link>
      </p>
    </div>
  );
}
