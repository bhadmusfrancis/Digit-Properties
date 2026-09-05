'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

type ConversationRow = {
  _id: string;
  yourRole: 'buyer' | 'owner';
  listing: { _id: string; title: string; path?: string } | null;
  otherParty: { _id: string; name: string } | null;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount?: number;
};

function timeLabel(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DashboardMessagesPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['dashboard-messages'],
    refetchInterval: 15000,
    queryFn: async () => {
      const r = await fetch('/api/messages');
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Failed to load messages');
      return j as { conversations: ConversationRow[] };
    },
  });

  const conversations = data?.conversations ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      <p className="mt-1 text-sm text-gray-600">Conversations about your listings and properties you contacted.</p>

      {isPending ? (
        <div className="mt-6 space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-200" />
        </div>
      ) : isError ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(error as Error).message}
        </p>
      ) : conversations.length === 0 ? (
        <p className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          No messages yet. Open a listing and send a message to start a conversation.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {conversations.map((c) => (
            <li key={c._id}>
              <Link
                href={`/dashboard/messages/${c._id}`}
                className="flex items-start justify-between gap-3 px-4 py-4 hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-gray-900">
                    {c.listing?.title || 'Listing'}
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-600">
                    {c.yourRole === 'owner' ? 'From' : 'To'} {c.otherParty?.name || 'User'}
                  </span>
                  <span className="mt-1 block truncate text-sm text-gray-500">
                    {c.lastMessagePreview || 'Open conversation'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs text-gray-400">{timeLabel(c.lastMessageAt)}</span>
                  {(c.unreadCount ?? 0) > 0 ? (
                    <span className="mt-2 inline-flex rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {c.unreadCount}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
