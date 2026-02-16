'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

export default function AlertsPage() {
  const [name, setName] = useState('');
  const [filters, setFilters] = useState({});
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetch('/api/alerts').then((r) => r.json()),
  });

  async function createAlert() {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || 'My search', filters, notifyPush: true, notifyEmail: true }),
    });
    if (res.ok) window.location.reload();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Saved Searches</h1>
      <p className="mt-1 text-gray-600">Get notified when new listings match your criteria.</p>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900">Create alert</h2>
        <input
          type="text"
          placeholder="Alert name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input mt-2 max-w-md"
        />
        <p className="mt-2 text-sm text-gray-500">
          Configure filters on the search page, then save your search from there. Or use the API to create alerts with filters.
        </p>
        <button onClick={createAlert} className="btn-primary mt-4">
          Create alert
        </button>
      </div>

      <div className="mt-8">
        <h2 className="font-semibold text-gray-900">Your alerts</h2>
        {isLoading ? (
          <div className="mt-4 h-24 animate-pulse rounded bg-gray-100" />
        ) : (
          <ul className="mt-4 space-y-2">
            {(alerts ?? []).map((a: { _id: string; name: string }) => (
              <li key={a._id} className="flex items-center justify-between rounded border border-gray-200 bg-white p-4">
                <span>{a.name}</span>
                <button
                  onClick={async () => {
                    await fetch(`/api/alerts/${a._id}`, { method: 'DELETE' });
                    window.location.reload();
                  }}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete
                </button>
              </li>
            ))}
            {(!alerts || alerts.length === 0) && (
              <li className="rounded border border-dashed border-gray-200 py-8 text-center text-gray-500">
                No saved searches yet.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
