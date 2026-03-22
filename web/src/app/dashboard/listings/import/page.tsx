'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ListingForm } from '@/components/listings/ListingForm';
import type { ListingFormRef } from '@/components/listings/ListingForm';
import type { ParsedListing } from '@/lib/whatsapp-listing-parser';
import { USER_ROLES, type ListingType } from '@/lib/constants';

export type EditInitialShape = {
  title: string;
  description: string;
  listingType: ListingType;
  propertyType: string;
  price: number;
  address: string;
  city: string;
  state: string;
  suburb: string;
  bedrooms: number;
  bathrooms: number;
  toilets: number;
  area?: number;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  rentPeriod?: 'day' | 'month' | 'year';
  status: 'draft' | 'active';
  amenities: string;
  images?: { url: string; public_id: string }[];
};

function parsedToEditInitial(parsed: ParsedListing, images?: { url: string; public_id: string }[]): EditInitialShape {
  return {
    title: parsed.title,
    description: parsed.description,
    listingType: parsed.listingType,
    propertyType: parsed.propertyType,
    price: parsed.price,
    address: parsed.location.address,
    city: parsed.location.city,
    state: parsed.location.state,
    suburb: parsed.location.suburb ?? '',
    bedrooms: parsed.bedrooms,
    bathrooms: parsed.bathrooms,
    toilets: parsed.toilets ?? 0,
    area: parsed.area,
    agentName: parsed.agentName ?? '',
    agentPhone: parsed.agentPhone ?? '',
    agentEmail: parsed.agentEmail ?? '',
    rentPeriod: parsed.rentPeriod,
    status: 'draft',
    amenities: Array.isArray(parsed.amenities) ? parsed.amenities.join(', ') : '',
    images: images ?? [],
  };
}

function buildListingPayload(
  item: EditInitialShape
): Record<string, unknown> {
  const location = {
    address: item.address,
    city: item.city,
    state: item.state,
    ...(item.suburb && { suburb: item.suburb }),
  };
  return {
    title: item.title,
    description: item.description,
    listingType: item.listingType,
    propertyType: item.propertyType,
    price: item.price,
    location,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    toilets: item.toilets,
    area: item.area,
    agentName: item.agentName || undefined,
    agentPhone: item.agentPhone || undefined,
    agentEmail: item.agentEmail || undefined,
    rentPeriod: item.rentPeriod,
    status: item.status,
    amenities: item.amenities ? item.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [],
    tags: ['whatsapp-import'],
    images: item.images ?? [],
  };
}

type SenderDetails = { name?: string; phone?: string; waId?: string };

type ImportMode = 'single' | 'multiple';

/** Per-index list of possible duplicate existing listings (from check-duplicates API). */
type DuplicateMap = Record<number, { _id: string; title: string }[]>;

export default function ImportFromWhatsAppPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [text, setText] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<EditInitialShape[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [senderDetails, setSenderDetails] = useState<SenderDetails | null>(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [duplicateMap, setDuplicateMap] = useState<DuplicateMap>({});
  const [saveAllStatus, setSaveAllStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<ListingFormRef | null>(null);

  if (sessionStatus === 'loading') {
    return <p className="p-4 text-gray-500">Loading...</p>;
  }
  if (!session?.user || (session.user as { role?: string }).role !== USER_ROLES.BOT) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-xl font-bold text-gray-900">Import from WhatsApp</h1>
        <p className="mt-2 text-gray-600">Only BOT accounts can use this feature.</p>
        <Link href="/dashboard/listings" className="mt-4 inline-block text-primary-600 hover:underline">
          ← Back to My Properties
        </Link>
      </div>
    );
  }

  const handleParse = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      setError('Paste at least 10 characters from the WhatsApp message.');
      return;
    }
    setError(null);
    setSaveAllStatus('idle');
    setSaveError(null);
    setLoading(true);
    try {
      const multiple = importMode === 'multiple';
      const res = await fetch('/api/listings/parse-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, multiple }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to parse');
        setLoading(false);
        return;
      }
      const items = data.listings
        ? (data.listings as { parsed: ParsedListing; confidence?: string; missing?: string[] }[])
        : data.parsed
          ? [{ parsed: data.parsed, confidence: data.confidence, missing: data.missing }]
          : [];
      if (items.length === 0) {
        setError('Could not extract any listing from the text. Try adjusting the message or import type.');
        setLoading(false);
        return;
      }
      const withMedia = data.mediaUrls && Array.isArray(data.mediaUrls) && data.mediaUrls.length > 0;
      const firstImages = withMedia
        ? (data.mediaUrls as string[]).map((url: string) => ({ url, public_id: '' }))
        : undefined;
      const initialListings: EditInitialShape[] = items.map((r, i) =>
        parsedToEditInitial(r.parsed, i === 0 ? firstImages : undefined)
      );
      setListings(initialListings);
      setCurrentIndex(0);
      setSenderDetails(data.senderDetails ?? null);
      setMediaUrls(data.mediaUrls ?? []);
      setDuplicateMap({});

      const checkRes = await fetch('/api/listings/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listings: initialListings.map((l) => ({
            title: l.title,
            price: l.price,
            city: l.city,
            state: l.state,
            agentPhone: l.agentPhone || undefined,
          })),
        }),
      });
      if (checkRes.ok) {
        const dupData = await checkRes.json();
        const map: DuplicateMap = {};
        for (const r of dupData.results ?? []) {
          if (r.duplicates?.length) map[r.index] = r.duplicates;
        }
        setDuplicateMap(map);
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentIntoListings = () => {
    if (!formRef.current || !listings) return;
    const values = formRef.current.getValues();
    const images = formRef.current.getImages();
    const updated: EditInitialShape = {
      title: values.title,
      description: values.description,
      listingType: values.listingType as ListingType,
      propertyType: values.propertyType,
      price: values.price,
      address: values.address,
      city: values.city,
      state: values.state,
      suburb: values.suburb ?? '',
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      toilets: values.toilets ?? 0,
      area: values.area,
      agentName: values.agentName ?? '',
      agentPhone: values.agentPhone ?? '',
      agentEmail: values.agentEmail ?? '',
      rentPeriod: values.rentPeriod,
      status: (values.status as 'draft' | 'active') ?? 'draft',
      amenities: values.amenities ?? '',
      images,
    };
    setListings((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[currentIndex] = updated;
      return next;
    });
  };

  const goNext = () => {
    saveCurrentIntoListings();
    if (listings && currentIndex < listings.length - 1) setCurrentIndex((i) => i + 1);
  };

  const goPrev = () => {
    saveCurrentIntoListings();
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleSaveAll = async () => {
    if (!listings?.length) return;
    setSaveAllStatus('saving');
    setSaveError(null);
    const toSave = listings.map((item) => ({ ...item }));
    if (formRef.current) {
      const v = formRef.current.getValues();
      const imgs = formRef.current.getImages();
      toSave[currentIndex] = {
        ...toSave[currentIndex],
        title: v.title,
        description: v.description,
        listingType: v.listingType as ListingType,
        propertyType: v.propertyType,
        price: v.price,
        address: v.address,
        city: v.city,
        state: v.state,
        suburb: v.suburb ?? '',
        bedrooms: v.bedrooms,
        bathrooms: v.bathrooms,
        toilets: v.toilets ?? 0,
        area: v.area,
        agentName: v.agentName ?? '',
        agentPhone: v.agentPhone ?? '',
        agentEmail: v.agentEmail ?? '',
        rentPeriod: v.rentPeriod,
        status: (v.status as 'draft' | 'active') ?? 'draft',
        amenities: v.amenities ?? '',
        images: imgs,
      };
    }
    let success = 0;
    let lastError = '';
    for (let i = 0; i < toSave.length; i++) {
      const payload = buildListingPayload(toSave[i]);
      try {
        const res = await fetch('/api/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) success++;
        else {
          const err = await res.json();
          lastError = err.error || res.statusText;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Request failed';
      }
    }
    setSaveAllStatus(success === toSave.length ? 'done' : lastError ? 'error' : 'done');
    setSaveError(success < toSave.length ? lastError : null);
    if (success === toSave.length) {
      setTimeout(() => {
        window.location.href = '/dashboard/listings';
      }, 1500);
    }
  };

  const isMulti = listings && listings.length > 1;
  const currentListing = listings ? listings[currentIndex] : null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href="/dashboard/listings" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          ← My Properties
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Import from WhatsApp</h1>
      <p className="mt-1 text-sm text-gray-600">
        Paste a property message below. Choose whether it’s one listing or several so we can parse it accurately.
      </p>

      {!listings ? (
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What are you pasting?</label>
            <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Import type">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'single'}
                  onChange={() => setImportMode('single')}
                  className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-800">Single listing</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'multiple'}
                  onChange={() => setImportMode('multiple')}
                  className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-800">Multiple listings</span>
              </label>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {importMode === 'single'
                ? 'One property only — we’ll parse the whole message as a single listing for better accuracy.'
                : 'Several properties in one message (e.g. numbered list or separated by lines) — we’ll split and parse each.'}
            </p>
          </div>
          <label className="block text-sm font-medium text-gray-700">Pasted message</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={importMode === 'single' ? 'e.g. 3bed flat for rent in Lekki 500k per year call 08012345678' : 'e.g. (1) 500sqm at Ikoyi 2.7bn\n(2) 847sqm front plot...'}
            className="w-full min-h-[140px] rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            rows={8}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleParse}
            disabled={loading}
            className="btn-primary min-h-[44px] px-4"
          >
            {loading ? 'Parsing…' : importMode === 'single' ? 'Parse listing' : 'Parse listings'}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {senderDetails && (senderDetails.name || senderDetails.phone) && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <span className="font-medium text-gray-700">Sender: </span>
              {[senderDetails.name, senderDetails.phone].filter(Boolean).join(' • ')}
            </div>
          )}
          {mediaUrls.length > 0 && (
            <p className="text-sm text-gray-500">
              {mediaUrls.length} media file(s) from message — add to listing images below if needed.
            </p>
          )}

          {duplicateMap[currentIndex]?.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p className="font-medium text-amber-800">Possible duplicate of existing listing(s)</p>
              <p className="mt-1 text-amber-700">
                This import may match listings you already have. Review before saving to avoid duplicates.
              </p>
              <ul className="mt-2 space-y-1">
                {duplicateMap[currentIndex].map((dup) => (
                  <li key={dup._id}>
                    <a
                      href={`/listings/${dup._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      {dup.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {isMulti && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <span className="text-sm font-medium text-gray-700">
                Listing {currentIndex + 1} of {listings.length}
                {duplicateMap[currentIndex]?.length > 0 && (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Possible duplicate
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={currentIndex >= listings.length - 1}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <ListingForm
              key={currentIndex}
              editInitial={currentListing ?? undefined}
              getFormRef={formRef}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saveAllStatus === 'saving'}
              className="btn-primary min-h-[44px] px-4"
            >
              {saveAllStatus === 'saving'
                ? 'Saving…'
                : listings.length > 1
                  ? `Save all ${listings.length} as drafts`
                  : 'Save as draft'}
            </button>
            {saveAllStatus === 'done' && (
              <span className="text-sm text-green-600">Saved. Redirecting to My Properties…</span>
            )}
            {saveAllStatus === 'error' && saveError && (
              <span className="text-sm text-red-600">{saveError}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setListings(null);
              setCurrentIndex(0);
              setSenderDetails(null);
              setMediaUrls([]);
              setDuplicateMap({});
              setSaveAllStatus('idle');
              setSaveError(null);
            }}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Parse a different message
          </button>
        </div>
      )}
    </div>
  );
}
