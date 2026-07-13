'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { shouldTrackPath } from '@/lib/analytics-track';

const SESSION_STORAGE_KEY = 'dp_visitor_client';

function getClientSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function trackPageView(path: string) {
  if (!shouldTrackPath(path)) return;
  const payload = {
    path,
    referrer: document.referrer || undefined,
    sessionId: getClientSessionId(),
  };
  fetch('/api/analytics/pageview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    if (lastTracked.current === path) return;
    lastTracked.current = path;
    trackPageView(pathname);
  }, [pathname, searchParams]);

  return null;
}
