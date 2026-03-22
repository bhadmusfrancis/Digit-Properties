'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const VERIFICATION_TYPES = [
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
  identityVerifiedAt?: string;
  livenessVerifiedAt?: string;
  phoneVerifiedAt?: string;
};

type VerificationRequestItem = {
  _id: string;
  type: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
};

export default function ApplyPage() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [requests, setRequests] = useState<VerificationRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestType, setRequestType] = useState<string>('registered_agent');
  const [requestCompanyPosition, setRequestCompanyPosition] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/verification/request', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([me, list]) => {
      if (me) setUser(me);
      if (Array.isArray(list)) setRequests(list);
      setLoading(false);
    });
  }, []);

  const verificationComplete = !!(
    user?.identityVerifiedAt &&
    user?.livenessVerifiedAt &&
    user?.phoneVerifiedAt
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const needsPosition = requestType === 'registered_agent' || requestType === 'registered_developer';
    if (needsPosition && !requestCompanyPosition.trim()) {
      setSubmitError('Position in company is required for Agent/Developer.');
      return;
    }
    if (docFiles.length < 1) {
      setSubmitError('Upload at least one document (file upload only, no links).');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const urls: string[] = [];
      for (const file of docFiles) {
        const formData = new FormData();
        formData.set('file', file);
        formData.set('folder', 'verification');
        const up = await fetch('/api/upload', { method: 'POST', body: formData });
        const upData = await up.json();
        if (!up.ok || !upData.url) {
          setSubmitError(upData.error || 'Document upload failed');
          setSubmitting(false);
          return;
        }
        urls.push(upData.url);
      }
      const res = await fetch('/api/verification/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: requestType,
          documentUrls: urls,
          companyPosition: needsPosition ? requestCompanyPosition.trim() : undefined,
          message: requestMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRequests((prev) => [data, ...prev]);
        setDocFiles([]);
        setRequestMessage('');
      } else {
        setSubmitError(data.error || 'Submit failed');
      }
    } catch {
      setSubmitError('Request failed');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!verificationComplete) {
    return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Apply for Registered Agent / Developer</h2>
        <p className="mt-2 text-sm text-gray-700">
          Complete your Verified Individual steps first (profile, ID document, liveness, and phone verification). Then you can apply for Registered Agent or Developer here.
        </p>
        <Link href="/dashboard/profile" className="btn-primary mt-4 inline-block">
          Go to Profile & Verification
        </Link>
      </div>
      <p>
        <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">← Dashboard</Link>
      </p>
    </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Apply for Registered Agent / Developer</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload documents, choose type, and submit. You can do this anytime from your profile or this page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="space-y-4">
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
                value={requestCompanyPosition}
                onChange={(e) => setRequestCompanyPosition(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700">Documents (upload from your device)</label>
            <p className="mt-1 text-xs text-gray-500">
              Select files from your device only. Do not paste links or URLs.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setDocFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              className="input mt-2 block w-full text-sm"
              aria-label="Choose document files from your device"
            />
            {docFiles.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {docFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {f.name}
                    <button
                      type="button"
                      onClick={() => setDocFiles((p) => p.filter((_, j) => j !== i))}
                      className="text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Message (optional)</label>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              rows={2}
              className="input mt-1 w-full"
              placeholder="Note for reviewer"
            />
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <button type="submit" disabled={submitting || docFiles.length < 1} className="btn-primary">
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>

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
                {r.rejectionReason && <span className="text-gray-500">— {r.rejectionReason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p>
        <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">← Dashboard</Link>
      </p>
    </div>
  );
}
