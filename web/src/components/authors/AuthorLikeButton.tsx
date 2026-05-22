'use client';

import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface AuthorLikeButtonProps {
  authorId: string;
  /** Full-width layout for listing author panel. */
  variant?: 'default' | 'panel';
  signInCallbackUrl?: string;
}

export function AuthorLikeButton({
  authorId,
  variant = 'default',
  signInCallbackUrl,
}: AuthorLikeButtonProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const isOwnProfile = !!session?.user?.id && session.user.id === authorId;
  const signInUrl = `/auth/signin?callbackUrl=${encodeURIComponent(signInCallbackUrl ?? `/authors/${authorId}`)}`;

  const { data: likeData } = useQuery({
    queryKey: ['author-like', authorId],
    queryFn: () => fetch(`/api/authors/${authorId}/like`).then((r) => r.json()),
    enabled: !!authorId,
  });

  const likeCount = typeof likeData?.likeCount === 'number' ? likeData.likeCount : 0;
  const liked = !!likeData?.liked;

  const toggleLike = useMutation({
    mutationFn: () => fetch(`/api/authors/${authorId}/like`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: (data: { liked?: boolean; likeCount?: number }) => {
      if (typeof data.liked === 'boolean' || typeof data.likeCount === 'number') {
        queryClient.setQueryData(['author-like', authorId], (prev: { likeCount?: number; liked?: boolean } | undefined) => ({
          ...prev,
          liked: typeof data.liked === 'boolean' ? data.liked : prev?.liked,
          likeCount: typeof data.likeCount === 'number' ? data.likeCount : prev?.likeCount,
        }));
      }
    },
  });

  const isPanel = variant === 'panel';

  return (
    <div
      className={
        isPanel
          ? 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'
          : 'mt-3 flex flex-wrap items-center gap-3'
      }
    >
      <span className={`tabular-nums ${isPanel ? 'text-sm font-medium text-gray-700' : 'text-sm text-gray-500'}`}>
        {likeCount} like{likeCount !== 1 ? 's' : ''}
      </span>
      {status === 'loading' ? null : isOwnProfile ? (
        <span className="text-sm text-gray-400">Your profile</span>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (status === 'loading') return;
            if (!session) {
              router.push(signInUrl);
              return;
            }
            toggleLike.mutate();
          }}
          disabled={toggleLike.isPending}
          className={isPanel ? 'btn-secondary w-full sm:w-auto' : 'btn-secondary text-sm'}
        >
          {toggleLike.isPending ? '…' : liked ? 'Unlike' : 'Like'} author
        </button>
      )}
    </div>
  );
}
