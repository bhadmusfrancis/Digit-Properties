type SystemNoticeKind = 'success' | 'error' | 'warning' | 'info';

const KIND: Record<SystemNoticeKind, { wrap: string; iconWrap: string; title: string; body: string }> = {
  success: {
    wrap: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    title: 'text-emerald-950',
    body: 'text-emerald-800',
  },
  error: {
    wrap: 'border-rose-200/80 bg-gradient-to-br from-rose-50 to-white',
    iconWrap: 'bg-rose-100 text-rose-700',
    title: 'text-rose-950',
    body: 'text-rose-800',
  },
  warning: {
    wrap: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white',
    iconWrap: 'bg-amber-100 text-amber-800',
    title: 'text-amber-950',
    body: 'text-amber-800',
  },
  info: {
    wrap: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-white',
    iconWrap: 'bg-sky-100 text-sky-700',
    title: 'text-sky-950',
    body: 'text-sky-800',
  },
};

function NoticeIcon({ kind }: { kind: SystemNoticeKind }) {
  const className = 'h-4 w-4';
  if (kind === 'success') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (kind === 'error') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    );
  }
  if (kind === 'warning') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
    </svg>
  );
}

export function SystemNotice({
  kind,
  title,
  children,
  className = '',
}: {
  kind: SystemNoticeKind;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const style = KIND[kind];
  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-sm ${style.wrap} ${className}`}
      role={kind === 'error' || kind === 'warning' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="flex gap-3">
        <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}>
          <NoticeIcon kind={kind} />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {title ? <p className={`font-semibold ${style.title}`}>{title}</p> : null}
          {children ? <div className={`${title ? 'mt-1' : ''} ${style.body}`}>{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
