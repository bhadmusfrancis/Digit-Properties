'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import {
  NIGERIAN_STATES,
  PROPERTY_TYPES,
  POPULAR_AMENITIES,
  LISTING_TYPE,
} from '@/lib/constants';
import { LocationAddress } from '@/components/listings/LocationAddress';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { generateListingTitle } from '@/lib/listing-title';
import { generateListingDescriptionHtml } from '@/lib/listing-description';
import { mergeUniqueLists, normalizeList } from '@/lib/listing-amenities';
import { formatListingLocationDisplay } from '@/lib/listing-location';
import { getCloudinaryVideoThumbnailUrl } from '@/lib/listing-default-image';
import {
  countPlannedMediaUploads,
  fileLooksLikeVideo,
  LISTING_FILE_UPLOAD_ACCEPT,
  LISTING_VIDEO_PICK_ACCEPT,
} from '@/lib/listing-media-accept';
import { formatBytes } from '@/lib/format-bytes';
import { uploadListingMediaFile } from '@/lib/upload-listing-media';
import { stripHtml } from '@/lib/utils';

const propertyTypeEnum = z.enum(PROPERTY_TYPES as unknown as [string, ...string[]]);

/** Step-only schemas: full `wizardSchema` runs on the whole form via z4 resolver, so `trigger([subset])` still fails on empty title/description/address. */
const wizardStep1Schema = z
  .object({
    listingType: z.enum(Object.values(LISTING_TYPE) as [string, ...string[]]),
    propertyTypes: z.array(propertyTypeEnum).min(1, 'Select at least one property type').max(3, 'You can select up to 3'),
    price: z.preprocess(
      (v) =>
        v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))
          ? undefined
          : Number(v),
      z.number({ required_error: 'Enter a price' }).positive('Enter a price greater than 0')
    ),
    rentPeriod: z.enum(['day', 'month', 'year']).optional(),
    bedrooms: z.number().int().min(0),
    bathrooms: z.number().int().min(0),
    toilets: z.number().int().min(0).optional(),
    area: z.preprocess(
      (v) =>
        v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))
          ? undefined
          : Number(v),
      z.number().positive().optional()
    ),
  })
  .refine((d) => d.listingType !== 'rent' || !!d.rentPeriod, {
    message: 'Rent period is required for rentals',
    path: ['rentPeriod'],
  });

const wizardStep2Schema = z
  .object({
    address: z.string().min(5, 'Address is too short'),
    city: z.string().min(2, 'City is required'),
    state: z.enum(NIGERIAN_STATES as unknown as [string, ...string[]]),
    suburb: z.string().optional(),
    contactSource: z.enum(['author', 'listing']),
    agentName: z.string().optional(),
    agentPhone: z.string().optional(),
    agentEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  })
  .refine(
    (d) =>
      d.contactSource !== 'listing' ||
      !!(String(d.agentPhone || '').trim() || String(d.agentEmail || '').trim() || String(d.agentName || '').trim()),
    {
      message: 'Add property contact details or choose Author contact',
      path: ['agentPhone'],
    }
  );

const wizardSchema = z
  .object({
    title: z.string().min(5).max(200),
    description: z
      .string()
      .max(20000)
      .refine((s) => stripHtml(s).length >= 20, { message: 'Description must be at least 20 characters' }),
    listingType: z.enum(Object.values(LISTING_TYPE) as [string, ...string[]]),
    propertyTypes: z.array(propertyTypeEnum).min(1, 'Select at least one property type').max(3, 'You can select up to 3'),
    price: z.preprocess(
      (v) =>
        v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))
          ? undefined
          : Number(v),
      z.number({ required_error: 'Enter a price' }).positive('Enter a price greater than 0')
    ),
    address: z.string().min(5),
    city: z.string().min(2),
    state: z.enum(NIGERIAN_STATES as unknown as [string, ...string[]]),
    suburb: z.string().optional(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    bedrooms: z.number().int().min(0),
    bathrooms: z.number().int().min(0),
    toilets: z.number().int().min(0).optional(),
    area: z.preprocess(
      (v) =>
        v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))
          ? undefined
          : Number(v),
      z.number().positive().optional()
    ),
    amenities: z.string().optional(),
    tags: z.string().optional(),
    contactSource: z.enum(['author', 'listing']).default('author'),
    agentName: z.string().optional(),
    agentPhone: z.string().optional(),
    agentEmail: z.string().email().optional().or(z.literal('')),
    rentPeriod: z.enum(['day', 'month', 'year']).optional(),
    status: z.enum(['draft', 'active']).optional(),
  })
  .refine((d) => d.listingType !== 'rent' || !!d.rentPeriod, {
    message: 'Rent period is required for rentals',
    path: ['rentPeriod'],
  })
  .refine(
    (d) =>
      d.contactSource !== 'listing' ||
      !!(String(d.agentPhone || '').trim() || String(d.agentEmail || '').trim() || String(d.agentName || '').trim()),
    {
      message: 'Add property contact details or choose Author contact',
      path: ['agentPhone'],
    }
  );

export type WizardFormData = z.infer<typeof wizardSchema>;

const STEP1_FIELDS: (keyof WizardFormData)[] = [
  'listingType',
  'propertyTypes',
  'price',
  'rentPeriod',
  'bedrooms',
  'bathrooms',
  'toilets',
  'area',
];

const STEP2_FIELDS: (keyof WizardFormData)[] = [
  'address',
  'city',
  'state',
  'suburb',
  'contactSource',
  'agentName',
  'agentPhone',
  'agentEmail',
];

const STEPS = [
  { n: 1, label: 'Property', sub: 'Type, details & amenities' },
  { n: 2, label: 'Location', sub: 'Address & contact' },
  { n: 3, label: 'Publish', sub: 'Story & photos' },
];

type UploadUiState =
  | { status: 'idle' }
  | {
      status: 'uploading';
      fileIndex: number;
      fileTotal: number;
      percent: number;
      fileName: string;
      loadedBytes: number;
      totalBytes: number;
    };

export function NewListingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const stepRef = useRef(step);
  stepRef.current = step;
  const [images, setImages] = useState<{ url: string; public_id: string }[]>([]);
  const [videos, setVideos] = useState<{ url: string; public_id: string }[]>([]);
  const [uploadUi, setUploadUi] = useState<UploadUiState>({ status: 'idle' });
  const uploadAbortRef = useRef<AbortController | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoPickInputRef = useRef<HTMLInputElement>(null);
  const videoRecordInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadUi.status === 'uploading';

  const beginUploadBatch = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = new AbortController();
  };

  const endUploadBatch = () => {
    uploadAbortRef.current = null;
    setUploadUi({ status: 'idle' });
  };

  const cancelOngoingUploads = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadUi({ status: 'idle' });
  };

  async function runUploadWithProgress(
    file: File,
    attemptIndex: number,
    attemptTotal: number
  ): Promise<{ url: string; public_id: string; type: 'image' | 'video' } | null> {
    const ac = uploadAbortRef.current;
    if (!ac) return null;
    setUploadUi({
      status: 'uploading',
      fileIndex: attemptIndex + 1,
      fileTotal: attemptTotal,
      percent: attemptTotal > 0 ? (attemptIndex / attemptTotal) * 100 : 0,
      fileName: file.name,
      loadedBytes: 0,
      totalBytes: file.size,
    });
    try {
      const result = await uploadListingMediaFile(file, {
        signal: ac.signal,
        onProgress: ({ loaded, total }) => {
          const t = total > 0 ? total : file.size;
          if (!t || attemptTotal <= 0) return;
          const base = (attemptIndex / attemptTotal) * 100;
          const slice = 100 / attemptTotal;
          const pct = base + (loaded / t) * slice;
          setUploadUi((u) =>
            u.status === 'uploading'
              ? {
                  ...u,
                  percent: Math.min(99.9, pct),
                  loadedBytes: loaded,
                  totalBytes: t,
                }
              : u
          );
        },
      });
      setUploadUi((u) =>
        u.status === 'uploading'
          ? {
              ...u,
              percent: Math.min(100, ((attemptIndex + 1) / attemptTotal) * 100),
              loadedBytes: u.totalBytes,
            }
          : u
      );
      return result;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      alert(e instanceof Error ? e.message : 'Upload failed');
      return null;
    }
  }

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const r = await fetch('/api/dashboard/stats');
      if (!r.ok) return {};
      return r.json();
    },
  });
  const maxImages = typeof stats?.maxImages === 'number' ? stats.maxImages : 10;
  const maxVideos = typeof stats?.maxVideos === 'number' ? stats.maxVideos : 1;

  const methods = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      listingType: 'sale',
      status: 'draft',
      propertyTypes: ['apartment'],
      bedrooms: 0,
      bathrooms: 0,
      toilets: 0,
      state: NIGERIAN_STATES[0],
      contactSource: 'author',
      title: '',
      description: '',
      address: '',
      city: '',
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = methods;

  const watched = watch();
  const propertyTypes = watched.propertyTypes ?? [];

  const amenityList = Array.from(
    new Set([...(watched.amenities ? watched.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [])])
  );

  const toggleAmenity = (name: string) => {
    const current = watched.amenities
      ? watched.amenities.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const set = new Set(current);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    setValue('amenities', Array.from(set).join(', '), { shouldValidate: true });
  };

  const togglePropertyType = (t: (typeof PROPERTY_TYPES)[number]) => {
    const cur = [...propertyTypes];
    const i = cur.indexOf(t);
    if (i >= 0) {
      if (cur.length <= 1) return;
      cur.splice(i, 1);
    } else if (cur.length < 3) {
      cur.push(t);
    }
    setValue('propertyTypes', cur, { shouldValidate: true });
  };

  const locationLine = useCallback((v: WizardFormData) => {
    return formatListingLocationDisplay({
      address: v.address,
      suburb: v.suburb,
      city: v.city,
      state: v.state,
    });
  }, []);

  const buildTitleInput = (v: WizardFormData) => ({
    listingType: v.listingType,
    propertyType: v.propertyTypes[0] || 'apartment',
    propertyTypes: v.propertyTypes,
    address: v.address,
    state: v.state,
    city: v.city,
    suburb: v.suburb,
    bedrooms: v.bedrooms,
    bathrooms: v.bathrooms,
    toilets: v.toilets,
    area: v.area,
    amenities: v.amenities ? v.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [],
  });

  const fillStep3Defaults = (overwriteDescription: boolean, overwriteTitle: boolean) => {
    const v = getValues();
    const loc = locationLine(v);
    const list = v.amenities ? v.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [];

    if (overwriteDescription || stripHtml(v.description || '').length < 20) {
      setValue(
        'description',
        generateListingDescriptionHtml({
          ...buildTitleInput(v),
          price: v.price,
          locationLine: loc,
          rentPeriod: v.rentPeriod,
        }),
        { shouldValidate: true }
      );
    }
    if (overwriteTitle || !String(v.title || '').trim()) {
      setValue('title', generateListingTitle({ ...buildTitleInput(v), description: v.description }), {
        shouldValidate: true,
      });
    }
  };

  const goNext = () => {
    if (step === 1) {
      const v = getValues();
      const step1 = wizardStep1Schema.safeParse({
        listingType: v.listingType,
        propertyTypes: v.propertyTypes,
        price: v.price,
        rentPeriod: v.rentPeriod,
        bedrooms: v.bedrooms,
        bathrooms: v.bathrooms,
        toilets: v.toilets,
        area: v.area,
      });
      if (!step1.success) {
        clearErrors(STEP1_FIELDS);
        for (const iss of step1.error.issues) {
          const key = iss.path[0];
          if (typeof key === 'string' || typeof key === 'number') {
            setError(String(key) as keyof WizardFormData, { message: iss.message });
          }
        }
        return;
      }
      clearErrors(STEP1_FIELDS);
      setStep(2);
    } else if (step === 2) {
      const v = getValues();
      const step2 = wizardStep2Schema.safeParse({
        address: v.address,
        city: v.city,
        state: v.state,
        suburb: v.suburb,
        contactSource: v.contactSource,
        agentName: v.agentName,
        agentPhone: v.agentPhone,
        agentEmail: v.agentEmail,
      });
      if (!step2.success) {
        clearErrors(STEP2_FIELDS);
        for (const iss of step2.error.issues) {
          const key = iss.path[0];
          if (typeof key === 'string' || typeof key === 'number') {
            setError(String(key) as keyof WizardFormData, { message: iss.message });
          }
        }
        return;
      }
      clearErrors(STEP2_FIELDS);
      // Defer advancing so the Continue control is not replaced by submit buttons during the
      // same click/tap; otherwise the gesture can “fall through” and trigger publish.
      window.setTimeout(() => {
        setStep(3);
        // Always rebuild description from current form data (price, location, etc.).
        fillStep3Defaults(true, false);
      }, 0);
    }
  };

  const goBack = () => {
    if (isUploading) cancelOngoingUploads();
    if (step > 1) setStep((s) => s - 1);
  };

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    let imgRoom = maxImages - images.length;
    let vidRoom = maxVideos - videos.length;
    const batchTotal = countPlannedMediaUploads(files, imgRoom, vidRoom);
    if (!batchTotal) {
      e.target.value = '';
      return;
    }
    beginUploadBatch();
    let ir = imgRoom;
    let vr = vidRoom;
    const newImgs: { url: string; public_id: string }[] = [];
    const newVids: { url: string; public_id: string }[] = [];
    let attempt = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const expectVideo = fileLooksLikeVideo(file);
        if (expectVideo) {
          if (vr <= 0) continue;
          let up: { url: string; public_id: string; type: 'image' | 'video' } | null = null;
          try {
            up = await runUploadWithProgress(file, attempt, batchTotal);
          } catch {
            break;
          }
          attempt++;
          if (!up) continue;
          if (up.type === 'video') {
            newVids.push({ url: up.url, public_id: up.public_id });
            vr -= 1;
          } else if (up.type === 'image' && ir > 0) {
            newImgs.push({ url: up.url, public_id: up.public_id });
            ir -= 1;
          }
        } else {
          if (ir <= 0) continue;
          let up: { url: string; public_id: string; type: 'image' | 'video' } | null = null;
          try {
            up = await runUploadWithProgress(file, attempt, batchTotal);
          } catch {
            break;
          }
          attempt++;
          if (!up) continue;
          if (up.type === 'image') {
            newImgs.push({ url: up.url, public_id: up.public_id });
            ir -= 1;
          } else if (up.type === 'video' && vr > 0) {
            newVids.push({ url: up.url, public_id: up.public_id });
            vr -= 1;
          }
        }
      }
    } finally {
      endUploadBatch();
    }
    if (newImgs.length) setImages((prev) => [...prev, ...newImgs]);
    if (newVids.length) setVideos((prev) => [...prev, ...newVids]);
    e.target.value = '';
  }

  async function onCameraFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || images.length >= maxImages) {
      e.target.value = '';
      return;
    }
    beginUploadBatch();
    try {
      try {
        const up = await runUploadWithProgress(file, 0, 1);
        if (up?.type === 'image') setImages((prev) => [...prev, { url: up.url, public_id: up.public_id }]);
      } catch {
        /* aborted */
      }
    } finally {
      endUploadBatch();
    }
    e.target.value = '';
  }

  async function onVideoPickChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    let vidRoom = maxVideos - videos.length;
    const batchTotal = countPlannedMediaUploads(files, maxImages - images.length, vidRoom);
    if (!batchTotal) {
      e.target.value = '';
      return;
    }
    beginUploadBatch();
    let vr = vidRoom;
    const newVids: { url: string; public_id: string }[] = [];
    let attempt = 0;
    try {
      for (let i = 0; i < files.length && vr > 0; i++) {
        const file = files[i];
        let up: { url: string; public_id: string; type: 'image' | 'video' } | null = null;
        try {
          up = await runUploadWithProgress(file, attempt, batchTotal);
        } catch {
          break;
        }
        attempt++;
        if (up?.type === 'video') {
          newVids.push({ url: up.url, public_id: up.public_id });
          vr -= 1;
        }
      }
    } finally {
      endUploadBatch();
    }
    if (newVids.length) setVideos((prev) => [...prev, ...newVids]);
    e.target.value = '';
  }

  async function onVideoRecordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || videos.length >= maxVideos) {
      e.target.value = '';
      return;
    }
    beginUploadBatch();
    try {
      try {
        const up = await runUploadWithProgress(file, 0, 1);
        if (up?.type === 'video') setVideos((prev) => [...prev, { url: up.url, public_id: up.public_id }]);
      } catch {
        /* aborted */
      }
    } finally {
      endUploadBatch();
    }
    e.target.value = '';
  }

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const newOrder = [...images];
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setImages(newOrder);
  };

  const moveVideo = (index: number, direction: 'left' | 'right') => {
    const newOrder = [...videos];
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setVideos(newOrder);
  };

  async function onSubmit(data: WizardFormData) {
    const dupRes = await fetch('/api/listings/check-new-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        imagePublicIds: images.map((i) => i.public_id),
        videoPublicIds: videos.map((v) => v.public_id),
      }),
    });
    if (dupRes.status === 409) {
      const err = await dupRes.json().catch(() => ({}));
      alert(typeof err.error === 'string' ? err.error : 'This listing matches one you already posted.');
      return;
    }

    const location: Record<string, unknown> = {
      address: data.address,
      city: data.city,
      state: data.state,
    };
    if (data.suburb) location.suburb = data.suburb;
    if (data.coordinates) location.coordinates = data.coordinates;

    const payload: Record<string, unknown> = {
      ...data,
      propertyTypes: data.propertyTypes,
      location,
      amenities: normalizeList(data.amenities ? data.amenities.split(',') : []),
      tags: mergeUniqueLists(
        data.tags ? data.tags.split(',') : [],
        data.amenities ? data.amenities.split(',') : []
      ),
      images,
      videos,
    };
    if (payload.area === undefined || (typeof payload.area === 'number' && Number.isNaN(payload.area))) {
      delete payload.area;
    }
    delete payload.address;
    delete payload.city;
    delete payload.state;
    delete payload.suburb;
    delete payload.coordinates;

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      if (err.code === 'LISTING_LIMIT_REACHED') {
        alert(err.error || 'Listing limit reached.');
        return;
      }
      if (err.code === 'DUPLICATE_TITLE' || err.code === 'DUPLICATE_DESCRIPTION' || err.code === 'DUPLICATE_MEDIA') {
        alert(err.error || 'This listing looks like a duplicate.');
        return;
      }
      const msg = typeof err.error === 'string' ? err.error : 'Failed to create listing';
      alert(msg);
      return;
    }
    const listing = await res.json();
    router.push('/listings/' + listing._id);
  }

  return (
    <FormProvider {...methods}>
      <div className="relative overflow-hidden rounded-3xl border border-sky-100/80 bg-gradient-to-br from-white via-sky-50/40 to-emerald-50/30 shadow-xl shadow-sky-900/5">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent"
          aria-hidden
        />

        {/* Progress */}
        <div className="border-b border-sky-100/60 bg-white/60 px-4 py-6 backdrop-blur-sm sm:px-8">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
            {STEPS.map((s, idx) => (
              <div key={s.n} className="flex flex-1 items-center gap-2">
                <div className="flex flex-1 flex-col items-center text-center">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold transition-all ${
                      step === s.n
                        ? 'bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-500/30'
                        : step > s.n
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {step > s.n ? '✓' : s.n}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-gray-900 sm:text-sm">{s.label}</p>
                  <p className="hidden text-[11px] text-gray-500 sm:block">{s.sub}</p>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`mx-1 hidden h-0.5 flex-1 rounded-full sm:block ${step > s.n ? 'bg-emerald-300' : 'bg-gray-200'}`}
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            if (stepRef.current < 3) {
              e.preventDefault();
              return;
            }
            if (uploadUi.status === 'uploading') {
              e.preventDefault();
              return;
            }
            void handleSubmit(onSubmit)(e);
          }}
          className="space-y-8 px-4 py-8 sm:px-8 sm:py-10"
        >
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900">How are you listing?</h2>
                <p className="mt-1 text-sm text-gray-600">Pick a listing type—buyers and tenants filter by this first.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      { value: LISTING_TYPE.SALE, title: 'For sale', emoji: '🏷️', hint: 'Outright purchase' },
                      { value: LISTING_TYPE.RENT, title: 'For rent', emoji: '🔑', hint: 'Lease or tenancy' },
                      { value: LISTING_TYPE.JOINT_VENTURE, title: 'Joint venture', emoji: '🤝', hint: 'Partnership / JV' },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md ${
                        watched.listingType === opt.value
                          ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-200'
                          : 'border-gray-200 bg-white hover:border-sky-200'
                      }`}
                    >
                      <input type="radio" {...register('listingType')} value={opt.value} className="sr-only" />
                      <span className="text-2xl">{opt.emoji}</span>
                      <p className="mt-2 font-semibold text-gray-900">{opt.title}</p>
                      <p className="text-xs text-gray-500">{opt.hint}</p>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900">Property types</h2>
                <p className="mt-1 text-sm text-gray-600">Select up to three if the property fits multiple categories.</p>
                <p className="mt-2 text-xs font-medium text-sky-700">Selected: {propertyTypes.length} / 3</p>
                {errors.propertyTypes && (
                  <p className="mt-1 text-sm text-red-600">{(errors.propertyTypes as { message?: string }).message}</p>
                )}
                <div className="mt-3 flex max-h-52 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-gray-100 bg-white/80 p-3 sm:max-h-none">
                  {PROPERTY_TYPES.map((t) => {
                    const selected = propertyTypes.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => togglePropertyType(t)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all sm:text-sm ${
                          selected
                            ? 'bg-gradient-to-r from-sky-600 to-emerald-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {t.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">Numbers that sell</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Price (NGN) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" {...register('price', { valueAsNumber: true })} className="input mt-1" placeholder="e.g. 50000000" />
                    {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>}
                  </div>
                  {watched.listingType === 'rent' && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Rent period</span>
                      <div className="mt-2 flex flex-wrap gap-3" role="radiogroup">
                        {(['day', 'month', 'year'] as const).map((p) => (
                          <label key={p} className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              {...register('rentPeriod')}
                              value={p}
                              className="h-4 w-4 border-gray-300 text-sky-600"
                            />
                            <span className="text-sm">Per {p === 'day' ? 'day' : p === 'month' ? 'month' : 'year'}</span>
                          </label>
                        ))}
                      </div>
                      {errors.rentPeriod && <p className="mt-1 text-sm text-red-600">{errors.rentPeriod.message}</p>}
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Bedrooms</label>
                    <input type="number" {...register('bedrooms', { valueAsNumber: true })} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Bathrooms</label>
                    <input type="number" {...register('bathrooms', { valueAsNumber: true })} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Toilets</label>
                    <input type="number" {...register('toilets', { valueAsNumber: true })} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Area (sqm)</label>
                    <input type="number" {...register('area', { valueAsNumber: true })} className="input mt-1" placeholder="Optional" />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-900">Amenities</h2>
                <p className="mt-1 text-sm text-gray-600">Tap to toggle—every extra helps your property stand out.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {POPULAR_AMENITIES.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleAmenity(a)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                        amenityList.includes(a)
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <input {...register('amenities')} placeholder="Custom (comma-separated)" className="input mt-3" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Where is it?</h2>
                <p className="mt-1 text-sm text-gray-600">Accurate location builds trust and better search matches.</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm">
                <LocationAddress />
                {errors.address && <p className="mt-2 text-sm text-red-600">{errors.address.message}</p>}
                {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
                {errors.state && <p className="mt-1 text-sm text-red-600">{errors.state.message}</p>}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">Contact</h2>
                <p className="mt-1 text-sm text-gray-600">Who should enquiries go to?</p>
                <div className="mt-4 flex flex-wrap gap-4" role="radiogroup">
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 ${
                      watched.contactSource === 'author' ? 'border-sky-500 bg-sky-50' : 'border-gray-200'
                    }`}
                  >
                    <input type="radio" {...register('contactSource')} value="author" className="h-4 w-4 text-sky-600" />
                    <span className="text-sm font-medium text-gray-800">Author contact</span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 ${
                      watched.contactSource === 'listing' ? 'border-sky-500 bg-sky-50' : 'border-gray-200'
                    }`}
                  >
                    <input type="radio" {...register('contactSource')} value="listing" className="h-4 w-4 text-sky-600" />
                    <span className="text-sm font-medium text-gray-800">Property contact</span>
                  </label>
                </div>
                <div className="mt-3 space-y-2">
                  <input {...register('agentName')} placeholder="Name" className="input" />
                  <input {...register('agentPhone')} placeholder="Phone" className="input" />
                  <input {...register('agentEmail')} type="email" placeholder="Email" className="input" />
                </div>
                {errors.agentPhone && <p className="mt-1 text-sm text-red-600">{errors.agentPhone.message}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Title, description &amp; photos</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Review and edit the title and description, then add photos before you publish.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fillStep3Defaults(true, false)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                  >
                    Refresh description
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const v = getValues();
                      setValue('title', generateListingTitle({ ...buildTitleInput(v), description: v.description }), {
                        shouldValidate: true,
                      });
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                  >
                    Refresh title
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm">
                <label className="text-sm font-semibold text-gray-900">
                  Property title <span className="text-red-500">*</span>
                </label>
                <input {...register('title')} className="input mt-2" placeholder="Headline for search & sharing" />
                {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm">
                <label className="text-sm font-semibold text-gray-900">
                  Description <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      minHeight="220px"
                      disabled={isUploading}
                      placeholder="Describe your property in your own words."
                    />
                  )}
                />
                {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
              </div>

              <div className="rounded-2xl border border-dashed border-sky-200/80 bg-gradient-to-br from-sky-50/50 to-white p-5">
                <h3 className="font-semibold text-gray-900">Photos &amp; videos</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Up to {maxImages} photos (first is used in search) and {maxVideos} video{maxVideos === 1 ? '' : 's'} (MP4, WebM, MOV up to 50MB). On your phone you can add videos from your gallery or record a clip.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <input
                    type="file"
                    accept={LISTING_FILE_UPLOAD_ACCEPT}
                    multiple
                    onChange={onFileChange}
                    disabled={
                      isUploading || (images.length >= maxImages && videos.length >= maxVideos)
                    }
                    className="hidden"
                    id="wizard-file-upload"
                  />
                  <label
                    htmlFor="wizard-file-upload"
                    className={`cursor-pointer rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-95 ${
                      isUploading || (images.length >= maxImages && videos.length >= maxVideos)
                        ? 'pointer-events-none opacity-50'
                        : ''
                    }`}
                  >
                    Upload photos / videos
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={onCameraFileChange}
                    disabled={isUploading || images.length >= maxImages}
                    className="hidden"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isUploading || images.length >= maxImages}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Photo (camera)
                  </button>
                  <input
                    type="file"
                    accept={LISTING_VIDEO_PICK_ACCEPT}
                    multiple
                    ref={videoPickInputRef}
                    onChange={onVideoPickChange}
                    disabled={isUploading || videos.length >= maxVideos}
                    className="hidden"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => videoPickInputRef.current?.click()}
                    disabled={isUploading || videos.length >= maxVideos}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Add video
                  </button>
                  <input
                    type="file"
                    accept={LISTING_VIDEO_PICK_ACCEPT}
                    capture="environment"
                    ref={videoRecordInputRef}
                    onChange={onVideoRecordChange}
                    disabled={isUploading || videos.length >= maxVideos}
                    className="hidden"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => videoRecordInputRef.current?.click()}
                    disabled={isUploading || videos.length >= maxVideos}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Record video
                  </button>
                  <span className="self-center text-sm text-gray-500">
                    {images.length} / {maxImages} photos · {videos.length} / {maxVideos} videos
                  </span>
                </div>
                {uploadUi.status === 'uploading' && (
                  <div className="mt-3 space-y-2 rounded-xl border border-sky-200 bg-sky-50/90 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-800">
                        Uploading file {uploadUi.fileIndex} of {uploadUi.fileTotal}
                        {uploadUi.fileName ? (
                          <>
                            : <span className="font-medium break-all">{uploadUi.fileName}</span>
                          </>
                        ) : null}
                      </p>
                      <button
                        type="button"
                        onClick={cancelOngoingUploads}
                        className="shrink-0 text-sm font-medium text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-sky-600 transition-[width] duration-200"
                        style={{ width: `${Math.min(100, Math.max(0, uploadUi.percent))}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      {uploadUi.totalBytes > 0 ? (
                        <>
                          <span className="tabular-nums">
                            {formatBytes(uploadUi.loadedBytes)} / {formatBytes(uploadUi.totalBytes)}
                          </span>
                          <span className="mx-1.5 text-gray-400">·</span>
                        </>
                      ) : null}
                      {Math.round(uploadUi.percent)}% complete
                    </p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {images.map((img, index) => (
                    <div key={img.public_id} className="relative">
                      <img src={img.url} alt="" className="h-24 w-24 rounded-xl object-cover ring-2 ring-white shadow" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((i) => i.public_id !== img.public_id))}
                        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm text-white shadow"
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                      <div className="mt-1 flex justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveImage(index, 'left')}
                          disabled={index === 0}
                          className="text-xs text-gray-600 disabled:opacity-40"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 'right')}
                          disabled={index === images.length - 1}
                          className="text-xs text-gray-600 disabled:opacity-40"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  ))}
                  {videos.map((vid, index) => (
                    <div key={vid.public_id} className="relative">
                      <video
                        src={vid.url}
                        poster={getCloudinaryVideoThumbnailUrl(vid) ?? undefined}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-24 w-24 rounded-xl object-cover ring-2 ring-white shadow"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
                        Video
                      </span>
                      <button
                        type="button"
                        onClick={() => setVideos((prev) => prev.filter((v) => v.public_id !== vid.public_id))}
                        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm text-white shadow"
                        aria-label="Remove video"
                      >
                        ×
                      </button>
                      <div className="mt-1 flex justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveVideo(index, 'left')}
                          disabled={index === 0}
                          className="text-xs text-gray-600 disabled:opacity-40"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => moveVideo(index, 'right')}
                          disabled={index === videos.length - 1}
                          className="text-xs text-gray-600 disabled:opacity-40"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-8">
            <div className="flex gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={isUploading}
                  className="rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:opacity-95 disabled:opacity-60"
                >
                  Continue
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    onClick={() => setValue('status', 'draft')}
                    disabled={isSubmitting || isUploading}
                    className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Save draft
                  </button>
                  <button
                    type="submit"
                    onClick={() => setValue('status', 'active')}
                    disabled={isSubmitting || isUploading}
                    className="rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:opacity-95 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Publishing…' : 'Publish property'}
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
