'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type RequestItem = {
  _id: string;
  type: string;
  status: string;
  documentUrls: string[];
  companyPosition?: string;
  message?: string;
  rejectionReason?: string;
  documentVerificationMethod?: string;
  createdAt: string;
  reviewedAt?: string;
  userId: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    idFrontUrl?: string;
    idBackUrl?: string;
    livenessCentreImageUrl?: string;
  };
  reviewedBy?: { name?: string };
};

export default function AdminVerificationPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [actioning, setActioning] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  function load() {
    const q = statusFilter ? `?status=${statusFilter}` : '';
    fetch(`/api/admin/verification-requests${q}`)
      .then((r) => r.json())
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, [statusFilter]);

  async function handleApprove(id: string) {
    setActioning(id);
    try {
      const res = await fetch(`/api/admin/verification-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentVerificationMethod: 'manual' }),
      });
      if (res.ok) load();
    } catch {
      //
    }
    setActioning(null);
  }

  async function handleReject(id: string) {
    const reason = rejectReason[id] ?? '';
    setActioning(id);
    try {
      const res = await fetch(`/api/admin/verification-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setRejectReason((prev) => ({ ...prev, [id]: '' }));
        load();
      }
    } catch {
      //
    }
    setActioning(null);
  }

  const typeLabel = (type: string) =>
    type === 'verified_individual'
      ? 'Verified Individual'
      : type === 'registered_agent'
        ? 'Registered Agent'
        : 'Registered Developer';

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Verification requests</h2>
      <p className="mt-1 text-sm text-gray-500">
        Review ID and professional documents; approve or reject. On approve, user role and profile
        picture lock are updated.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`min-h-11 min-w-[5.5rem] flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize sm:flex-none sm:px-3 sm:py-1.5 ${
              statusFilter === s
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="mt-4 text-gray-500">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="mt-4 text-gray-500">No requests found.</p>
      ) : (
        <div className="mt-4 -mx-1 overflow-x-auto rounded-lg border border-gray-200 bg-white px-1 shadow-sm sm:mx-0 sm:px-0">
          <table className="min-w-[44rem] divide-y divide-gray-200 text-left text-sm sm:min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 font-medium text-gray-700 sm:px-4">User</th>
                <th className="hidden sm:table-cell px-4 py-3 font-medium text-gray-700">Type</th>
                <th className="hidden lg:table-cell px-4 py-3 font-medium text-gray-700">Position</th>
                <th className="px-3 py-3 font-medium text-gray-700 sm:px-4">Documents</th>
                <th className="px-3 py-3 font-medium text-gray-700 sm:px-4">Status</th>
                {statusFilter === 'pending' && (
                  <th className="min-w-[10rem] px-3 py-3 font-medium text-gray-700 sm:px-4">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="max-w-[12rem] px-3 py-3 sm:max-w-none sm:px-4">
                    <div>
                      <span className="font-medium">{r.userId?.name ?? '—'}</span>
                      <span className="mt-0.5 block truncate text-sm text-gray-500">{r.userId?.email}</span>
                      <span className="mt-1 block text-xs text-gray-500 sm:hidden">{typeLabel(r.type)}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{typeLabel(r.type)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">{r.companyPosition ?? '—'}</td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex flex-wrap gap-2">
                      {r.userId?.livenessCentreImageUrl && (
                        <span className="inline-flex flex-col items-center">
                          <span className="text-xs text-gray-500">Liveness (centre)</span>
                          <a
                            href={r.userId.livenessCentreImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block h-14 w-14 overflow-hidden rounded border border-gray-200 bg-gray-100"
                          >
                            <img
                              src={r.userId.livenessCentreImageUrl}
                              alt="Liveness"
                              className="h-full w-full object-cover"
                            />
                          </a>
                        </span>
                      )}
                      {r.userId?.idFrontUrl && (
                        <span className="inline-flex flex-col items-center">
                          <span className="text-xs text-gray-500">ID front</span>
                          <a
                            href={r.userId.idFrontUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block h-14 w-14 overflow-hidden rounded border border-gray-200 bg-gray-100"
                          >
                            <img src={r.userId.idFrontUrl} alt="ID front" className="h-full w-full object-cover" />
                          </a>
                        </span>
                      )}
                      {r.userId?.idBackUrl && (
                        <span className="inline-flex flex-col items-center">
                          <span className="text-xs text-gray-500">ID back</span>
                          <a
                            href={r.userId.idBackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block h-14 w-14 overflow-hidden rounded border border-gray-200 bg-gray-100"
                          >
                            <img src={r.userId.idBackUrl} alt="ID back" className="h-full w-full object-cover" />
                          </a>
                        </span>
                      )}
                    </div>
                    {r.documentUrls?.length
                      ? r.documentUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block text-sm text-primary-600 hover:underline"
                          >
                            View doc {i + 1}
                          </a>
                        ))
                      : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
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
                      <span className="ml-1 text-gray-500">— {r.rejectionReason}</span>
                    )}
                  </td>
                  {statusFilter === 'pending' && (
                    <td className="min-w-[10rem] px-3 py-3 sm:px-4">
                      <div className="flex max-w-[16rem] flex-col gap-2 sm:max-w-none">
                        <input
                          type="text"
                          placeholder="Rejection reason (optional)"
                          value={rejectReason[r._id] ?? ''}
                          onChange={(e) =>
                            setRejectReason((prev) => ({ ...prev, [r._id]: e.target.value }))
                          }
                          className="input w-full max-w-full text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(r._id)}
                            disabled={actioning === r._id}
                            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {actioning === r._id ? '…' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(r._id)}
                            disabled={actioning === r._id}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {actioning === r._id ? '…' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">
          ← Admin
        </Link>
      </p>
    </div>
  );
}
