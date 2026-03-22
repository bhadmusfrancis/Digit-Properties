'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getWhatsAppUrl } from '@/lib/utils';
import { USER_ROLES } from '@/lib/constants';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';

type ClaimListing = { _id: string; title: string; price: number; listingType?: string; location?: { city?: string; state?: string } };

interface Props {
  listingId: string;
  title: string;
  createdBy: { _id: string; firstName?: string; name?: string; role?: string } | null;
  createdByType: string;
  baseUrl: string;
  isOwner?: boolean;
  viewCount?: number;
  likeCount?: number;
}

export function ListingDetailClient({ listingId, title, createdBy, createdByType, baseUrl, isOwner, viewCount = 0, likeCount: initialLikeCount = 0 }: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimStep, setClaimStep] = useState<'send' | 'verify' | 'list'>('send');
  const [claimPinId, setClaimPinId] = useState<string | null>(null);
  const [claimPhoneDisplay, setClaimPhoneDisplay] = useState<string>('');
  const [claimOtp, setClaimOtp] = useState('');
  const [claimListings, setClaimListings] = useState<ClaimListing[]>([]);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(false);
  const viewRecorded = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!listingId || viewRecorded.current) return;
    viewRecorded.current = true;
    fetch(`/api/listings/${listingId}/view`, { method: 'POST' }).catch(() => {});
  }, [listingId]);

  const { data: contact } = useQuery({
    queryKey: ['contact', listingId],
    queryFn: () => fetch(`/api/listings/${listingId}/contact`).then((r) => r.json()),
    enabled: !!session && !!listingId,
  });

  const { data: likeData } = useQuery({
    queryKey: ['like', listingId],
    queryFn: () => fetch(`/api/listings/${listingId}/like`).then((r) => r.json()),
    enabled: !!listingId,
  });
  useEffect(() => {
    if (likeData && typeof likeData.likeCount === 'number') setLikeCount(likeData.likeCount);
    if (likeData && typeof likeData.liked === 'boolean') setLiked(likeData.liked);
  }, [likeData]);

  const { data: savedData, refetch: refetchSaved } = useQuery({
    queryKey: ['saved'],
    queryFn: () => fetch('/api/saved').then((r) => r.json()),
    enabled: !!session,
  });
  const savedIds = Array.isArray(savedData)
    ? savedData.map((l: { _id?: string }) => (typeof l === 'object' && l?._id ? String(l._id) : null)).filter(Boolean)
    : [];
  const isSaved = savedIds.includes(listingId);

  const toggleSaved = useMutation({
    mutationFn: () =>
      fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      }).then((r) => r.json()),
    onSuccess: () => refetchSaved(),
  });

  const toggleLike = useMutation({
    mutationFn: () => fetch(`/api/listings/${listingId}/like`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: (data: { liked?: boolean; likeCount?: number }) => {
      if (typeof data.liked === 'boolean') setLiked(data.liked);
      if (typeof data.likeCount === 'number') setLikeCount(data.likeCount);
    },
  });

  const sendClaimOtp = useMutation({
    mutationFn: () =>
      fetch('/api/claims/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      }).then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d)))),
    onSuccess: (data: { pinId: string; phoneDisplay: string }) => {
      setClaimPinId(data.pinId);
      setClaimPhoneDisplay(data.phoneDisplay || '');
      setClaimStep('verify');
    },
  });

  const verifyClaimOtp = useMutation({
    mutationFn: ({ pin, pinId }: { pin: string; pinId: string }) =>
      fetch('/api/claims/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinId, pin, listingId }),
      }).then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d)))),
    onSuccess: (data: { verified: boolean; listings: ClaimListing[] }) => {
      if (data.verified && Array.isArray(data.listings)) {
        setClaimListings(data.listings);
        setClaimStep('list');
      }
    },
  });

  const claimAllMutation = useMutation({
    mutationFn: (ids: string[]) =>
      fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingIds: ids }),
      }).then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d)))),
    onSuccess: () => {
      setClaimOpen(false);
      setClaimStep('send');
      setClaimPinId(null);
      setClaimPhoneDisplay('');
      setClaimOtp('');
      setClaimListings([]);
      queryClient.invalidateQueries({ queryKey: ['contact', listingId] });
      router.push('/dashboard/claims');
    },
  });

  const closeClaimModal = () => {
    setClaimOpen(false);
    setClaimStep('send');
    setClaimPinId(null);
    setClaimPhoneDisplay('');
    setClaimOtp('');
    setClaimListings([]);
  };

  const listingUrl = `${baseUrl}/listings/${listingId}`;
  const whatsappMessage = `Hi, I'm interested in this property: ${title} - ${listingUrl}`;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
        <span>{viewCount} view{viewCount !== 1 ? 's' : ''}</span>
        <span>{likeCount} like{likeCount !== 1 ? 's' : ''}</span>
      </div>
      {session && !isOwner && (
        <button
          type="button"
          onClick={() => toggleLike.mutate()}
          className="btn-secondary w-full"
          disabled={toggleLike.isPending}
        >
          {liked ? 'Unlike' : 'Like'} listing
        </button>
      )}
      {createdBy && (
        <div>
          <p className="text-sm text-gray-500">Listed by</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {createdBy._id ? (
              <Link href={`/authors/${createdBy._id}`} className="font-medium text-primary-600 hover:underline">
                {createdBy.firstName ?? createdBy.name}
              </Link>
            ) : (
              <span className="font-medium">{createdBy.firstName ?? createdBy.name}</span>
            )}
            {createdBy.role && <VerifiedBadge role={createdBy.role} showCaveat />}
            {createdBy._id && (
              <Link href={`/authors/${createdBy._id}`} className="text-sm text-gray-500 hover:text-primary-600">
                View profile →
              </Link>
            )}
          </div>
        </div>
      )}

      {status === 'loading' ? (
        <div className="h-20 animate-pulse rounded bg-gray-200" />
      ) : session ? (
        <>
          {contact && (
            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="font-medium text-gray-900">Contact details</h4>
              {contact.agentName && <p className="mt-1">{contact.agentName}</p>}
              {contact.agentPhone && <p className="mt-1">{contact.agentPhone}</p>}
              {contact.agentPhone && (
                <a
                  href={getWhatsAppUrl(contact.agentPhone, whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-3 flex items-center gap-2"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Send WhatsApp message
                </a>
              )}
            </div>
          )}

          {!isOwner && (
            <button
              onClick={() => toggleSaved.mutate()}
              className="btn-secondary w-full"
            >
              {isSaved ? 'Remove from Favorites' : 'Add to Favorites'}
            </button>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Sign in to view contact details and add this listing to your favorites.
          </p>
          <Link href="/auth/signin" className="btn-primary mt-3 block text-center">
            Sign in
          </Link>
        </div>
      )}

      {(createdByType === 'bot' || createdBy?.role === USER_ROLES.BOT) && session && (
        <div className="border-t pt-4">
          <button
            onClick={() => {
              setClaimStep('send');
              setClaimPinId(null);
              setClaimPhoneDisplay('');
              setClaimOtp('');
              setClaimListings([]);
              setClaimOpen(true);
            }}
            className="btn-secondary w-full text-sm"
          >
            Claim this property
          </button>
        </div>
      )}

      {claimOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="claim-modal-title">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 id="claim-modal-title" className="text-lg font-semibold text-gray-900">Claim property</h2>

            {claimStep === 'send' && (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  Verify the listing contact number to claim. We&apos;ll send a one-time code via SMS to this number. Once verified, you can claim all listings linked to it without admin approval.
                </p>
                {contact?.agentPhone && (
                  <p className="mt-2 font-medium text-gray-900">Number: {contact.agentPhone}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => sendClaimOtp.mutate()}
                    disabled={sendClaimOtp.isPending || !contact?.agentPhone}
                    className="btn-primary flex-1"
                  >
                    {sendClaimOtp.isPending ? 'Sending…' : 'Send code'}
                  </button>
                  <button type="button" onClick={closeClaimModal} className="btn-secondary">
                    Cancel
                  </button>
                </div>
                {sendClaimOtp.isError && (
                  <p className="mt-2 text-sm text-red-600">{(sendClaimOtp.error as { error?: string })?.error || 'Failed to send code'}</p>
                )}
              </>
            )}

            {claimStep === 'verify' && (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  Enter the 6-digit code sent to {claimPhoneDisplay || 'your phone'}.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={claimOtp}
                  onChange={(e) => setClaimOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input mt-3 w-full text-center text-lg tracking-widest"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => claimPinId && verifyClaimOtp.mutate({ pin: claimOtp, pinId: claimPinId })}
                    disabled={verifyClaimOtp.isPending || claimOtp.length !== 6 || !claimPinId}
                    className="btn-primary flex-1"
                  >
                    {verifyClaimOtp.isPending ? 'Verifying…' : 'Verify'}
                  </button>
                  <button type="button" onClick={() => { setClaimStep('send'); setClaimPinId(null); setClaimOtp(''); }} className="btn-secondary">
                    Back
                  </button>
                </div>
                {verifyClaimOtp.isError && (
                  <p className="mt-2 text-sm text-red-600">{(verifyClaimOtp.error as { error?: string })?.error || 'Invalid or expired code'}</p>
                )}
              </>
            )}

            {claimStep === 'list' && (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  You verified this number. The following {claimListings.length} listing{claimListings.length !== 1 ? 's' : ''} use it. Claim them all at once (no admin approval needed).
                </p>
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
                  {claimListings.map((l) => (
                    <li key={l._id} className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-gray-900">{l.title}</span>
                      <span className="shrink-0 text-gray-600">
                        ₦{typeof l.price === 'number' ? l.price.toLocaleString() : l.price}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => claimAllMutation.mutate(claimListings.map((l) => l._id))}
                    disabled={claimAllMutation.isPending || claimListings.length === 0}
                    className="btn-primary flex-1"
                  >
                    {claimAllMutation.isPending ? 'Claiming…' : `Claim all (${claimListings.length})`}
                  </button>
                  <button type="button" onClick={closeClaimModal} className="btn-secondary">
                    Cancel
                  </button>
                </div>
                {claimAllMutation.isError && (
                  <p className="mt-2 text-sm text-red-600">{(claimAllMutation.error as { error?: string })?.error || 'Failed to claim'}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
