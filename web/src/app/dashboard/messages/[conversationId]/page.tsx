'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

type MessagePerson = { _id: string; name: string };
type MessageRow = { _id: string; sender: MessagePerson | null; body: string; createdAt?: string };

function timeLabel(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DashboardMessageThreadPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['message-thread', conversationId],
    enabled: !!conversationId,
    refetchInterval: 8000,
    queryFn: async () => {
      const r = await fetch(`/api/messages/${conversationId}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Failed to load conversation');
      return j as {
        conversation: {
          listing: { title: string; path?: string } | null;
          otherParty: MessagePerson | null;
        };
        messages: MessageRow[];
      };
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [data?.messages?.length]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch(`/api/messages/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Failed to send');
      return j;
    },
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['message-thread', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-messages'] });
      queryClient.invalidateQueries({ queryKey: ['messages-unread'] });
    },
  });

  return (
    <div>
      <Link href="/dashboard/messages" className="text-sm font-medium text-primary-700 hover:underline">
        ← All messages
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-gray-900">
        {data?.conversation?.listing?.title || 'Conversation'}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        With {data?.conversation?.otherParty?.name || 'user'}
        {data?.conversation?.listing?.path ? (
          <>
            {' · '}
            <Link href={data.conversation.listing.path} className="text-primary-700 hover:underline">
              View listing
            </Link>
          </>
        ) : null}
      </p>

      {isPending ? (
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-gray-200" />
      ) : isError ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(error as Error).message}
        </p>
      ) : (
        <>
          <div className="mt-6 max-h-[28rem] space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
            {(data?.messages ?? []).map((m) => {
              const mine = !!session?.user?.id && m.sender?._id === session.user.id;
              return (
                <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {!mine && <p className="mb-0.5 text-[11px] font-semibold opacity-80">{m.sender?.name || 'User'}</p>}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-gray-500'}`}>
                      {timeLabel(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const text = body.trim();
              if (!text || send.isPending) return;
              send.mutate(text);
            }}
          >
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 2000))}
              rows={3}
              className="input w-full resize-y"
              placeholder="Write a reply…"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">{body.length}/2000</span>
              <button type="submit" className="btn-primary" disabled={!body.trim() || send.isPending}>
                {send.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
            {send.isError ? <p className="mt-2 text-sm text-red-600">{(send.error as Error).message}</p> : null}
          </form>
        </>
      )}
    </div>
  );
}
