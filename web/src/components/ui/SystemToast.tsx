'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type SystemToastKind = 'success' | 'error' | 'warning' | 'info';

export type SystemToastItem = {
  id: string;
  kind: SystemToastKind;
  title: string;
  message?: string;
};

type ShowToastInput = {
  kind?: SystemToastKind;
  title: string;
  message?: string;
  durationMs?: number;
};

type SystemToastContextValue = {
  toast: (input: ShowToastInput | string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

const SystemToastContext = createContext<SystemToastContextValue | null>(null);

const KIND_STYLES: Record<SystemToastKind, { wrap: string; icon: string; bar: string }> = {
  success: {
    wrap: 'border-emerald-100 bg-white text-emerald-950',
    icon: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
  },
  error: {
    wrap: 'border-rose-100 bg-white text-rose-950',
    icon: 'bg-rose-100 text-rose-700',
    bar: 'bg-rose-500',
  },
  warning: {
    wrap: 'border-amber-100 bg-white text-amber-950',
    icon: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-500',
  },
  info: {
    wrap: 'border-sky-100 bg-white text-sky-950',
    icon: 'bg-sky-100 text-sky-700',
    bar: 'bg-sky-500',
  },
};

function ToastIcon({ kind }: { kind: SystemToastKind }) {
  if (kind === 'success') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (kind === 'error') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (kind === 'warning') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
    </svg>
  );
}

export function SystemToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SystemToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ShowToastInput | string) => {
      const parsed: ShowToastInput = typeof input === 'string' ? { title: input } : input;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: SystemToastItem = {
        id,
        kind: parsed.kind ?? 'info',
        title: parsed.title,
        message: parsed.message,
      };
      setItems((prev) => [...prev.slice(-4), item]);
      const duration = parsed.durationMs ?? (item.kind === 'error' ? 7000 : 4500);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value = useMemo<SystemToastContextValue>(
    () => ({
      toast,
      success: (title, message) => toast({ kind: 'success', title, message }),
      error: (title, message) => toast({ kind: 'error', title, message }),
      warning: (title, message) => toast({ kind: 'warning', title, message }),
      info: (title, message) => toast({ kind: 'info', title, message }),
    }),
    [toast]
  );

  return (
    <SystemToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 top-3 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[22rem]"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => {
          const style = KIND_STYLES[item.kind];
          return (
            <div
              key={item.id}
              role={item.kind === 'error' || item.kind === 'warning' ? 'alert' : 'status'}
              className={`pointer-events-auto w-full overflow-hidden rounded-2xl border shadow-lg shadow-slate-900/10 ${style.wrap}`}
            >
              <div className={`h-1 w-full ${style.bar}`} />
              <div className="flex gap-3 px-3.5 py-3">
                <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.icon}`}>
                  <ToastIcon kind={item.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-5">{item.title}</p>
                  {item.message ? (
                    <p className="mt-0.5 text-xs leading-5 text-current/75">{item.message}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="shrink-0 rounded-md p-1 text-current/50 hover:bg-black/5 hover:text-current"
                  aria-label="Dismiss notification"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </SystemToastContext.Provider>
  );
}

export function useSystemToast(): SystemToastContextValue {
  const ctx = useContext(SystemToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return ctx;
}
