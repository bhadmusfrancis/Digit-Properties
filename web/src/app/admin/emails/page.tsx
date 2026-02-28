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

  const [emailConfigured, setEmailConfigured] = useState(true);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; errorDetail?: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const sendTest = () => {
    setTestResult(null);
    setTestLoading(true);
    fetch('/api/admin/emails/test', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => setTestResult({ ok: d.ok, message: d.message, errorDetail: d.errorDetail }))
      .catch(() => setTestResult({ ok: false, message: 'Request failed', errorDetail: 'Network or server error' }))
      .finally(() => setTestLoading(false));
  };

  useEffect(() => {
    fetch('/api/admin/emails')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d === 'object') {
          setTemplates(d.templates || d);
          if (typeof d.emailConfigured === 'boolean') setEmailConfigured(d.emailConfigured);
        }
      })
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
        if (typeof d === 'object') setTemplates(d.templates || d);
        setEditing(null);
      })
      .finally(() => setSaving(false));
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      {!emailConfigured && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Emails are not configured.</strong> Set <code className="bg-amber-100 px-1">RESEND_API_KEY</code> in your environment so welcome, verification, and admin notification emails are sent. See <code className="bg-amber-100 px-1">EMAIL_SETUP_GUIDE.md</code>.
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendTest}
          disabled={testLoading || !emailConfigured}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {testLoading ? 'Sending...' : 'Send test email'}
        </button>
        <span className="text-sm text-gray-500">Sends one test email to the configured admin address so you can verify Resend works.</span>
      </div>
      {testResult && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            testResult.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <p className="font-medium">{testResult.message}</p>
          {testResult.errorDetail && (
            <p className="mt-2 font-mono text-xs break-all">{testResult.errorDetail}</p>
          )}
        </div>
      )}
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
