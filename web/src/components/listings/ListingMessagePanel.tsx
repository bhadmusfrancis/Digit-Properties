'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

type MessagePerson = { _id: string; name: string; image?: string | null };
type MessageRow = { _id: string; sender: MessagePerson | null; body: string; createdAt?: string };
type ConversationRow = {
  _id: string;
  yourRole?: string;
  otherParty: MessagePerson | null;
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

function SignInPrompt({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="font-medium text-gray-900">Message about this listing</h4>
      <p className="mt-1 text-sm text-gray-600">
        Sign in with a verified email to chat with the lister about this property.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="btn-primary">
          Sign in
        </Link>
        <Link href={`/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="btn-secondary">
          Create account
        </Link>
      </div>
    </div>
  );
}

function Composer({
  disabled,
  pending,
  onSend,
}: {
  disabled?: boolean;
  pending?: boolean;
  onSend: (body: string) => void;
}) {
  const [body, setBody] = useState('');
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const text = body.trim();
        if (!text || disabled || pending) return;
        onSend(text);
        setBody('');
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 2000))}
        rows={3}
        disabled={disabled || pending}
        placeholder="Ask a question about this property…"
        className="input w-full resize-y"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">{body.length}/2000</span>
        <button type="submit" className="btn-primary" disabled={!body.trim() || pending || disabled}>
          {pending ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  );
}

function Thread({
  messages,
  currentUserId,
}: {
  messages: MessageRow[];
  currentUserId?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  if (!messages.length) {
    return <p className="text-sm text-gray-500">No messages yet. Start the conversation below.</p>;
  }

  return (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
      {messages.map((m) => {
        const mine = !!currentUserId && m.sender?._id === currentUserId;
        return (
          <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                mine ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {!mine && <p className="mb-0.5 text-[11px] font-semibold opacity-80">{m.sender?.name || 'User'}</p>}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-gray-500'}`}>{timeLabel(m.createdAt)}</p>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

export function ListingMessagePanel({
  listingId,
  listingPublicPath,
  isOwner,
}: {
  listingId: string;
  listingPublicPath: string;
  isOwner?: boolean;
}) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [ownerThreadId, setOwnerThreadId] = useState<string | null>(null);

  const enabled = status === 'authenticated' && !!listingId && session?.user?.emailVerified !== false;

  const listQuery = useQuery({
    queryKey: ['listing-messages', listingId],
    enabled,
    refetchInterval: 10000,
    queryFn: async () => {
      const r = await fetch(`/api/listings/${listingId}/messages`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(typeof data?.error === 'string' ? data.error : 'Failed to load messages') as Error & {
          code?: string;
          status?: number;
        };
        err.code = data?.code;
        err.status = r.status;
        throw err;
      }
      return data as {
        role: 'buyer' | 'owner';
        conversation: ConversationRow | null;
        conversations?: ConversationRow[];
        messages: MessageRow[];
      };
    },
  });

  const threadQuery = useQuery({
    queryKey: ['listing-messages', listingId, ownerThreadId],
    enabled: enabled && !!isOwner && !!ownerThreadId,
    refetchInterval: 8000,
    queryFn: async () => {
      const r = await fetch(`/api/listings/${listingId}/messages?conversationId=${ownerThreadId}`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to load thread');
      return data as { conversation: ConversationRow | null; messages: MessageRow[] };
    },
  });

  const send = useMutation({
    mutationFn: async (body: string) => {
      const r = await fetch(`/api/listings/${listingId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, conversationId: ownerThreadId || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to send');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-messages', listingId] });
      queryClient.invalidateQueries({ queryKey: ['messages-unread'] });
      if (ownerThreadId) {
        queryClient.invalidateQueries({ queryKey: ['listing-messages', listingId, ownerThreadId] });
      }
    },
  });

  if (status === 'loading') {
    return <div className="h-28 animate-pulse rounded-lg bg-gray-200" aria-hidden />;
  }

  if (status !== 'authenticated') {
    return <SignInPrompt callbackUrl={listingPublicPath} />;
  }

  if (session.user.emailVerified === false) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h4 className="font-medium text-amber-950">Verify your email</h4>
        <p className="mt-1 text-sm text-amber-900">
          Confirm your email address to message the lister about this property.
        </p>
        <Link href="/dashboard/profile" className="btn-secondary mt-3 inline-flex">
          Go to profile
        </Link>
      </div>
    );
  }

  const err = listQuery.error as (Error & { code?: string; status?: number }) | null;
  if (err?.code === 'EMAIL_NOT_VERIFIED' || err?.status === 403) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h4 className="font-medium text-amber-950">Verify your email</h4>
        <p className="mt-1 text-sm text-amber-900">{err.message}</p>
      </div>
    );
  }

  if (isOwner) {
    const conversations = listQuery.data?.conversations ?? [];
    const threadMessages = threadQuery.data?.messages ?? [];
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-gray-900">Listing messages</h4>
          <Link href="/dashboard/messages" className="text-xs font-medium text-primary-700 hover:underline">
            Inbox
          </Link>
        </div>
        {listQuery.isPending ? (
          <div className="mt-3 h-20 animate-pulse rounded bg-gray-200" aria-hidden />
        ) : conversations.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No one has messaged you about this listing yet.</p>
        ) : ownerThreadId ? (
          <div className="mt-3 space-y-3">
            <button
              type="button"
              className="text-sm font-medium text-primary-700 hover:underline"
              onClick={() => setOwnerThreadId(null)}
            >
              ← All conversations
            </button>
            <p className="text-sm text-gray-600">
              Chat with {threadQuery.data?.conversation?.otherParty?.name || 'buyer'}
            </p>
            <Thread messages={threadMessages} currentUserId={session.user.id} />
            <Composer pending={send.isPending} onSend={(body) => send.mutate(body)} />
            {send.isError ? <p className="text-sm text-red-600">{(send.error as Error).message}</p> : null}
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {conversations.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => setOwnerThreadId(c._id)}
                  className="flex w-full items-start justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-primary-200"
                >
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{c.otherParty?.name || 'Buyer'}</span>
                    <span className="block text-xs text-gray-500">{c.lastMessagePreview || 'Open conversation'}</span>
                  </span>
                  {(c.unreadCount ?? 0) > 0 ? (
                    <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {c.unreadCount}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const messages = listQuery.data?.messages ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="font-medium text-gray-900">Message about this listing</h4>
      <p className="mt-1 text-sm text-gray-600">Chat with the lister without leaving Digit Properties.</p>
      <div className="mt-3">
        {listQuery.isPending ? (
          <div className="h-20 animate-pulse rounded bg-gray-200" aria-hidden />
        ) : (
          <Thread messages={messages} currentUserId={session.user.id} />
        )}
      </div>
      <Composer pending={send.isPending} onSend={(body) => send.mutate(body)} />
      {send.isError ? <p className="mt-2 text-sm text-red-600">{(send.error as Error).message}</p> : null}
    </div>
  );
}
