'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Templates = Record<string, { subject: string; body: string }>;

export default function AdminEmailsPage() {
  const [templates, setTemplates] = useState<Templates>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/emails')
      .then((r) => r.json())
      .then((d) => typeof d === 'object' && setTemplates(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (key: string) => {
    setEditing(key);
    const t = templates[key] || { subject: '', body: '' };
    setSubject(t.subject);
    setBody(t.body);
  };

  const save = () => {
    if (!editing) return;
    setSaving(true);
    fetch('/api/admin/emails', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: editing, subject, body }),
    })
      .then((r) => r.ok && fetch('/api/admin/emails').then((r2) => r2.json()))
      .then((d) => {
        if (typeof d === 'object') setTemplates(d);
        setEditing(null);
      })
      .finally(() => setSaving(false));
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Email templates</h2>
      <p className="mt-1 text-sm text-gray-500">
        Edit subject and body for: new user welcome, new subscription, contact form, etc. Use HTML in body.
      </p>
      <div className="mt-6 space-y-4">
        {Object.entries(templates).map(([key]) => (
          <div key={key} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
              <button
                type="button"
                onClick={() => startEdit(key)}
                className="text-sm text-primary-600 hover:underline"
              >
                Edit
              </button>
            </div>
            {editing === key && (
              <div className="mt-4 space-y-2">
                <input
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input w-full"
                />
                <textarea
                  placeholder="Body (HTML)"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="input w-full font-mono text-sm"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={save} disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-6">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">← Back to Admin</Link>
      </p>
    </div>
  );
}
