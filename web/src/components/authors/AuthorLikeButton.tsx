'use client';

import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

interface AuthorLikeButtonProps {
  authorId: string;
}

export function AuthorLikeButton({ authorId }: AuthorLikeButtonProps) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const isOwnProfile = !!session?.user?.id && session.user.id === authorId;

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

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <span className="text-sm text-gray-500">
        {likeCount} like{likeCount !== 1 ? 's' : ''}
      </span>
      {status === 'loading' ? null : session ? (
        isOwnProfile ? (
          <span className="text-sm text-gray-400">Your profile</span>
        ) : (
          <button
            type="button"
            onClick={() => toggleLike.mutate()}
            disabled={toggleLike.isPending}
            className="btn-secondary text-sm"
          >
            {toggleLike.isPending ? '…' : liked ? 'Unlike' : 'Like'} author
          </button>
        )
      ) : (
        <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/authors/${authorId}`)}`} className="text-sm text-primary-600 hover:underline">
          Sign in to like
        </Link>
      )}
    </div>
  );
}
