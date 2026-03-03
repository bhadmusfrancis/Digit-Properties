'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LivenessCamera } from '@/components/verification/LivenessCamera';

const VERIFICATION_TYPES = [
  { value: 'verified_individual', label: 'Verified Individual' },
  { value: 'registered_agent', label: 'Registered Agent' },
  { value: 'registered_developer', label: 'Registered Developer' },
] as const;

const COMPANY_POSITIONS = [
  'Agent',
  'Senior Agent',
  'Team Lead',
  'Director',
  'CEO',
  'Marketing Manager',
  'Project Manager',
  'Other',
];

type UserMe = {
  name: string;
  email: string;
  phone?: string;
  role: string;
  verifiedAt?: string;
  phoneVerifiedAt?: string;
  identityVerifiedAt?: string;
  livenessVerifiedAt?: string;
  profilePictureLocked?: boolean;
  canChangeProfilePicture?: boolean;
  image?: string;
};

type VerificationRequestItem = {
  _id: string;
  type: string;
  status: string;
  documentUrls: string[];
  companyPosition?: string;
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
};

export default function VerificationPage() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [requests, setRequests] = useState<VerificationRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneConfirming, setPhoneConfirming] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [verifyLink, setVerifyLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestType, setRequestType] = useState<string>('verified_individual');
  const [companyPosition, setCompanyPosition] = useState('');
  const [documentUrls, setDocumentUrls] = useState<string[]>(['']);
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showLivenessCamera, setShowLivenessCamera] = useState(false);
  const [livenessUploading, setLivenessUploading] = useState(false);
  const [livenessMessage, setLivenessMessage] = useState<string | null>(null);

  function fetchUserAndRequests() {
    return Promise.all([
      fetch('/api/me').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/verification/request').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([me, list]) => {
        if (me) setUser(me);
        if (Array.isArray(list)) setRequests(list);
        if (me?.phone) setPhone(me.phone);
      })
      .catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    fetchUserAndRequests().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onFocus = () => fetchUserAndRequests();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function handleSendPhone() {
    if (!phone.trim()) return;
    setPhoneSending(true);
    setPhoneMessage(null);
    setVerifyLink(null);
    try {
      const res = await fetch('/api/me/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneMessage(data.message || 'Code sent.');
        if (data.verifyLink) setVerifyLink(data.verifyLink);
      } else {
        setPhoneMessage(data.error || 'Failed to send');
      }
    } catch {
      setPhoneMessage('Request failed');
    }
    setPhoneSending(false);
  }

  async function handleConfirmPhone() {
    if (!code.trim()) return;
    setPhoneConfirming(true);
    setPhoneMessage(null);
    try {
      const res = await fetch('/api/me/confirm-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.replace(/\D/g, '') }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneMessage('Phone verified.');
        setUser((u) => (u ? { ...u, phoneVerifiedAt: new Date().toISOString() } : null));
      } else {
        setPhoneMessage(data.error || 'Invalid code');
      }
    } catch {
      setPhoneMessage('Request failed');
    }
    setPhoneConfirming(false);
  }

  function addDocumentUrl() {
    setDocumentUrls((prev) => [...prev, '']);
  }

  function setDocumentUrl(i: number, v: string) {
    setDocumentUrls((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
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
        setUser((u) =>
          u
            ? {
                ...u,
                livenessVerifiedAt: new Date().toISOString(),
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

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    const urls = documentUrls.filter((u) => u.trim().startsWith('http'));
    if (urls.length < 1) {
      setSubmitError('Add at least one document URL (upload under Profile or Listings first).');
      return;
    }
    const needsPosition =
      requestType === 'registered_agent' || requestType === 'registered_developer';
    if (needsPosition && !companyPosition.trim()) {
      setSubmitError('Position in company is required for Agent/Developer.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/verification/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: requestType,
          documentUrls: urls,
          companyPosition: needsPosition ? companyPosition.trim() : undefined,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRequests((prev) => [data, ...prev]);
        setSubmitError(null);
        setDocumentUrls(['']);
        setMessage('');
      } else {
        setSubmitError(data.error || 'Submit failed');
      }
    } catch {
      setSubmitError('Request failed');
    }
    setSubmitting(false);
  }

  if (loading || !user) {
    return (
      <div>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const emailOk = !!(user.verifiedAt != null && user.verifiedAt !== '');
  const phoneOk = !!user.phoneVerifiedAt;
  const identityOk = !!user.identityVerifiedAt;
  const livenessOk = !!user.livenessVerifiedAt;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Verification</h2>
        <p className="mt-1 text-sm text-gray-500">
          Complete the steps below. All users need: Email, Phone, ID document, and Liveness. Then
          apply for Verified Individual, Registered Agent, or Registered Developer.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm" aria-label="Verification checklist">
        <h3 className="font-medium text-gray-900">Verification checklist</h3>
        <ul className="mt-3 space-y-2 text-sm" role="list">
          <li className="flex items-center gap-2" data-check="email">
            {emailOk ? (
              <span className="text-green-600" aria-hidden="true">✓</span>
            ) : (
              <span className="text-amber-600" aria-hidden="true">○</span>
            )}
            <span>Email verified</span>
          </li>
          <li className="flex items-center gap-2">
            {phoneOk ? (
              <span className="text-green-600">✓</span>
            ) : (
              <span className="text-amber-600">○</span>
            )}
            Phone (WhatsApp/SMS) verified
          </li>
          <li className="flex items-center gap-2">
            {identityOk ? (
              <span className="text-green-600">✓</span>
            ) : (
              <span className="text-amber-600">○</span>
            )}
            ID document approved
          </li>
          <li className="flex items-center gap-2">
            {livenessOk ? (
              <span className="text-green-600">✓</span>
            ) : (
              <span className="text-amber-600">○</span>
            )}
            Liveness (profile photo) verified
          </li>
        </ul>
      </section>

      {!phoneOk && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-medium text-gray-900">Verify phone (WhatsApp)</h3>
          <p className="mt-1 text-sm text-gray-500">
            Enter your phone number with country code (e.g. 08012345678 or +234…). We&apos;ll send a 6-digit code to your WhatsApp. Enter the code below to verify.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08012345678 or +234..."
              className="input w-56"
            />
            <button
              type="button"
              onClick={handleSendPhone}
              disabled={phoneSending}
              className="btn-primary"
            >
              {phoneSending ? 'Sending…' : 'Send code'}
            </button>
          </div>
          {verifyLink && (
            <div className="mt-2 space-y-1 text-xs text-gray-500">
              <p>
                We’ve sent the verification link to your email. Or use below:
              </p>
              <p>
                <a href={verifyLink} className="text-primary-600 underline">
                  Click here to verify
                </a>
                {' '}(open on the device with this phone number).
              </p>
              <p>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(verifyLink)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                >
                  Open in WhatsApp
                </a>
                {' '}— send the link to yourself, then tap it on your phone to verify.
              </p>
            </div>
          )}
          {phoneMessage && (
            <p className={`mt-2 text-sm ${phoneMessage.startsWith('Phone verified') ? 'text-green-600' : 'text-gray-700'}`}>
              {phoneMessage}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600">Code sent to your WhatsApp:</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="input w-32"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <button
              type="button"
              onClick={handleConfirmPhone}
              disabled={phoneConfirming || !code.trim()}
              className="btn-primary"
            >
              {phoneConfirming ? 'Verifying…' : 'Confirm'}
            </button>
          </div>
        </section>
      )}

      {!livenessOk && user.role !== 'admin' && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-medium text-gray-900">Liveness (profile photo)</h3>
          <p className="mt-1 text-sm text-gray-500">
            Use your device camera to verify you’re a real person. Centre your face in the oval,
            then follow the instructions (blink, turn head, smile). The photo will be your profile
            picture until you become a Registered Agent or Developer.
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
                Liveness must be completed with your device camera for identity proofing. No upload or link option.
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
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="font-medium text-gray-900">Apply for verification (role upgrade)</h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload ID or professional documents first (use Upload in dashboard or listing flow), then
          paste the image URLs here.
        </p>
        <form onSubmit={handleSubmitRequest} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="input mt-1 w-full max-w-xs"
            >
              {VERIFICATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {(requestType === 'registered_agent' || requestType === 'registered_developer') && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Position in company</label>
              <select
                value={companyPosition}
                onChange={(e) => setCompanyPosition(e.target.value)}
                className="input mt-1 w-full max-w-xs"
              >
                <option value="">Select…</option>
                {COMPANY_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Document URLs</label>
            {documentUrls.map((url, i) => (
              <input
                key={i}
                type="url"
                value={url}
                onChange={(e) => setDocumentUrl(i, e.target.value)}
                placeholder="https://..."
                className="input mt-1 w-full"
              />
            ))}
            <button type="button" onClick={addDocumentUrl} className="mt-2 text-sm text-primary-600 hover:underline">
              + Add another document
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="input mt-1 w-full"
              placeholder="Any note for the reviewer"
            />
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </section>

      {requests.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-medium text-gray-900">Your verification requests</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {r.type === 'verified_individual'
                    ? 'Verified Individual'
                    : r.type === 'registered_agent'
                      ? 'Registered Agent'
                      : 'Registered Developer'}
                </span>
                <span
                  className={
                    r.status === 'approved'
                      ? 'text-green-600'
                      : r.status === 'rejected'
                        ? 'text-red-600'
                        : 'text-amber-600'
                  }
                >
                  {r.status}
                </span>
                {r.rejectionReason && (
                  <span className="text-gray-500">— {r.rejectionReason}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p>
        <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">
          ← Dashboard
        </Link>
      </p>
    </div>
  );
}
