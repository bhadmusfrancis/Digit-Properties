'use client';

import { useState } from 'react';

type FixResponse = {
  ok?: boolean;
  dryRun?: boolean;
  scanned?: number;
  matchedForFix?: number;
  modifiedCount?: number;
  error?: string;
};

export function FixVictoriaIslandTitlesButton() {
  const [loading, setLoading] = useState<'idle' | 'preview' | 'apply'>('idle');
  const [msg, setMsg] = useState<string>('');

  const run = async (dryRun: boolean) => {
    setLoading(dryRun ? 'preview' : 'apply');
    setMsg('');
    try {
      const res = await fetch('/api/admin/listings/fix-victoria-island-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = (await res.json().catch(() => ({}))) as FixResponse;
      if (!res.ok) {
        setMsg(data.error || 'Failed to run title fix.');
        return;
      }
      if (dryRun) {
        setMsg(
          `Preview complete: scanned ${data.scanned ?? 0}, candidates ${data.matchedForFix ?? 0}.`
        );
      } else {
        setMsg(
          `Applied: scanned ${data.scanned ?? 0}, updated ${data.modifiedCount ?? 0} titles.`
        );
      }
    } catch {
      setMsg('Request failed. Try again.');
    } finally {
      setLoading('idle');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => run(true)}
        disabled={loading !== 'idle'}
        className="btn-secondary min-h-[44px]"
      >
        {loading === 'preview' ? 'Checking…' : 'Preview VI Title Fix'}
      </button>
      <button
        type="button"
        onClick={() => run(false)}
        disabled={loading !== 'idle'}
        className="btn-primary min-h-[44px]"
      >
        {loading === 'apply' ? 'Fixing…' : 'Fix Wrong VI Titles'}
      </button>
      {msg && <p className="w-full text-sm text-gray-600">{msg}</p>}
    </div>
  );
}

