'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NIGERIAN_STATES, PROPERTY_TYPES, POPULAR_AMENITIES, LISTING_TYPE } from '@/lib/constants';
import { LocationAddress } from '@/components/listings/LocationAddress';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { generateListingTitle } from '@/lib/listing-title';
import { mergeUniqueLists, normalizeList } from '@/lib/listing-amenities';
import { getCloudinaryVideoThumbnailUrl } from '@/lib/listing-default-image';
import {
  countPlannedMediaUploads,
  fileLooksLikeVideo,
  LISTING_FILE_UPLOAD_ACCEPT,
  LISTING_VIDEO_PICK_ACCEPT,
} from '@/lib/listing-media-accept';
import { formatBytes } from '@/lib/format-bytes';
import { uploadListingMediaFile } from '@/lib/upload-listing-media';
import { optionalListingAgentEmailSchema } from '@/lib/validations';
import { BoostPaywallModal, type PaywallReason, type PaywallSuccess } from '@/components/listings/BoostPaywallModal';
import { BOOST_PACKAGES } from '@/lib/boost-packages';

const propertyTypeEnum = z.enum(PROPERTY_TYPES as unknown as [string, ...string[]]);

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

const schema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(20000),
  listingType: z.enum(Object.values(LISTING_TYPE) as [string, ...string[]]),
  propertyTypes: z.array(propertyTypeEnum).min(1, 'Select at least one property type').max(3, 'You can select up to 3'),
  price: z.number().positive(),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.enum(NIGERIAN_STATES as unknown as [string, ...string[]]),
  suburb: z.string().optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  bedrooms: z.preprocess(
    (v) => (v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v)) ? 0 : Number(v)),
    z.number().int().min(0)
  ),
  bathrooms: z.preprocess(
    (v) => (v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v)) ? 0 : Number(v)),
    z.number().int().min(0)
  ),
  toilets: z.preprocess(
    (v) => (v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v)) ? 0 : Number(v)),
    z.number().int().min(0)
  ),
  area: z.preprocess((v) => (v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : Number(v)), z.number().positive().optional()),
  amenities: z.string().optional(),
  tags: z.string().optional(),
  contactSource: z.enum(['author', 'listing']).default('author'),
  agentName: z.string().optional(),
  agentPhone: z.string().optional(),
  agentEmail: optionalListingAgentEmailSchema,
  rentPeriod: z.enum(['day', 'month', 'year']).optional(),
  leaseDuration: z.string().optional(),
  status: z.enum(['draft', 'active']).optional(),
}).refine((d) => d.listingType !== 'rent' || !!d.rentPeriod, {
  message: 'Rent period is required for rental listings',
  path: ['rentPeriod'],
}).refine((d) => d.contactSource !== 'listing' || !!((d.agentPhone || '').trim() || (d.agentEmail || '').trim() || (d.agentName || '').trim()), {
  message: 'Add listing contact details (phone/email/name) or switch contact to Author contact.',
  path: ['agentPhone'],
});

type FormData = z.infer<typeof schema>;

export type ListingFormRef = {
  getValues: () => FormData;
  getImages: () => { url: string; public_id: string }[];
  getVideos: () => { url: string; public_id: string }[];
};

export type ListingFormProps = {
  editId?: string;
  editInitial?: Partial<FormData> & {
    images?: { url: string; public_id: string }[];
    videos?: { url: string; public_id: string }[];
    coordinates?: { lat: number; lng: number };
    /** @deprecated use propertyTypes */
    propertyType?: string;
  };
  /** When set, parent can read current form values and images (e.g. for multi-listing import next/prev). */
  getFormRef?: React.MutableRefObject<ListingFormRef | null>;
};

export function ListingForm({ editId, editInitial, getFormRef }: ListingFormProps = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [images, setImages] = useState<{ url: string; public_id: string }[]>(editInitial?.images ?? []);
  const [videos, setVideos] = useState<{ url: string; public_id: string }[]>(editInitial?.videos ?? []);
  const [uploadUi, setUploadUi] = useState<UploadUiState>({ status: 'idle' });
  const uploadAbortRef = useRef<AbortController | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoPickInputRef = useRef<HTMLInputElement>(null);
  const videoRecordInputRef = useRef<HTMLInputElement>(null);
  const [paywall, setPaywall] = useState<{ reason: PaywallReason } | null>(null);
  const [boostBanner, setBoostBanner] = useState<PaywallSuccess | null>(null);

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
    queryKey: ['dashboard', 'stats', editId ?? null],
    queryFn: async () => {
      const url = editId
        ? `/api/dashboard/stats?listingId=${encodeURIComponent(editId)}`
        : '/api/dashboard/stats';
      const r = await fetch(url);
      if (!r.ok) return {};
      return r.json();
    },
  });
  const maxImages = typeof stats?.maxImages === 'number' ? stats.maxImages : 10;
  const maxVideos = typeof stats?.maxVideos === 'number' ? stats.maxVideos : 1;
  const maxCategories = typeof stats?.maxCategories === 'number' ? stats.maxCategories : 1;
  const baseMaxCategories = typeof stats?.baseMaxCategories === 'number' ? stats.baseMaxCategories : maxCategories;
  const boostActive = !!stats?.boostActive || !!boostBanner;

  const onPaywallSuccess = (info: PaywallSuccess) => {
    setBoostBanner(info);
    setPaywall(null);
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    router.refresh();
  };

  const resolvedInitialTypes =
    editInitial &&
    Array.isArray((editInitial as { propertyTypes?: string[] }).propertyTypes) &&
    (editInitial as { propertyTypes?: string[] }).propertyTypes!.length > 0
      ? (editInitial as { propertyTypes: string[] }).propertyTypes
      : editInitial &&
          typeof (editInitial as { propertyType?: string }).propertyType === 'string' &&
          (editInitial as { propertyType: string }).propertyType
        ? [(editInitial as { propertyType: string }).propertyType]
        : ['apartment'];

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editInitial ? {
      title: editInitial.title ?? '',
      description: editInitial.description ?? '',
      listingType: editInitial.listingType ?? 'sale',
      propertyTypes: resolvedInitialTypes.slice(0, 3) as FormData['propertyTypes'],
      price: editInitial.price ?? 0,
      address: editInitial.address ?? '',
      city: editInitial.city ?? '',
      state: editInitial.state ?? NIGERIAN_STATES[0],
      suburb: editInitial.suburb ?? '',
      bedrooms: editInitial.bedrooms || undefined,
      bathrooms: editInitial.bathrooms || undefined,
      toilets: editInitial.toilets || undefined,
      area: editInitial.area,
      amenities: editInitial.amenities ?? '',
      contactSource: (editInitial as Partial<FormData> & { contactSource?: 'author' | 'listing' }).contactSource ?? 'author',
      agentName: editInitial.agentName ?? '',
      agentPhone: editInitial.agentPhone ?? '',
      agentEmail: editInitial.agentEmail ?? '',
      rentPeriod: editInitial.rentPeriod,
      status: editInitial.status ?? 'draft',
      coordinates: editInitial.coordinates,
    } : {
      listingType: 'sale',
      status: 'draft',
      propertyTypes: ['apartment'],
      bedrooms: undefined,
      bathrooms: undefined,
      toilets: undefined,
      state: NIGERIAN_STATES[0],
      contactSource: 'author',
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = methods;

  useEffect(() => {
    if (getFormRef) {
      getFormRef.current = {
        getValues: () => getValues() as FormData,
        getImages: () => images,
        getVideos: () => videos,
      };
    }
    return () => {
      if (getFormRef) getFormRef.current = null;
    };
  }, [getFormRef, getValues, images, videos]);

  const watched = watch();
  const propertyTypesSel = watched.propertyTypes ?? [];

  const togglePropertyType = (t: (typeof PROPERTY_TYPES)[number]) => {
    const cur = [...propertyTypesSel];
    const i = cur.indexOf(t);
    if (i >= 0) {
      if (cur.length <= 1) return;
      cur.splice(i, 1);
    } else {
      if (cur.length >= maxCategories) {
        if (maxCategories === 1) {
          setValue('propertyTypes', [t], { shouldValidate: true });
          return;
        }
        setPaywall({ reason: 'categories' });
        return;
      }
      cur.push(t);
    }
    setValue('propertyTypes', cur, { shouldValidate: true });
  };

  const amenityList = Array.from(
    new Set([
      ...(watched.amenities ? watched.amenities.split(',').map((s) => s.trim()).filter(Boolean) : []),
    ])
  );

  const toggleAmenity = (name: string) => {
    const current = watched.amenities ? watched.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const set = new Set(current);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    setValue('amenities', Array.from(set).join(', '), { shouldValidate: true });
  };

  const generateTitle = () => {
    const list = watched.amenities ? watched.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const title = generateListingTitle({
      listingType: watched.listingType,
      propertyType: propertyTypesSel[0] || 'apartment',
      propertyTypes: propertyTypesSel,
      address: watched.address,
      state: watched.state,
      city: watched.city,
      suburb: watched.suburb,
      bedrooms: watched.bedrooms,
      bathrooms: watched.bathrooms,
      toilets: watched.toilets,
      area: watched.area,
      amenities: list,
      description: watched.description,
    });
    setValue('title', title, { shouldValidate: true });
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

  function onCameraCapture() {
    cameraInputRef.current?.click();
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

  async function onSubmit(data: FormData) {
    const dupRes = await fetch('/api/listings/check-new-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        imagePublicIds: images.map((i) => i.public_id),
        videoPublicIds: videos.map((v) => v.public_id),
        ...(editId ? { excludeListingId: editId } : {}),
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
      location,
      amenities: normalizeList(data.amenities ? data.amenities.split(',') : []),
      tags: mergeUniqueLists(
        data.tags ? data.tags.split(',') : [],
        data.amenities ? data.amenities.split(',') : []
      ),
      images,
      videos,
    };
    if (payload.area === undefined || (typeof payload.area === 'number' && Number.isNaN(payload.area))) delete payload.area;
    delete payload.address;
    delete payload.city;
    delete payload.state;
    delete payload.suburb;
    delete payload.coordinates;

    if (editId) {
      const res = await fetch('/api/listings/' + editId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.code === 'DUPLICATE_TITLE' || err.code === 'DUPLICATE_DESCRIPTION' || err.code === 'DUPLICATE_MEDIA') {
          alert(err.error || 'This listing looks like a duplicate.');
          return;
        }
        alert(err.error || 'Failed to update listing');
        return;
      }
      router.push('/listings/' + editId);
      return;
    }

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      if (err.code === 'LISTING_LIMIT_REACHED') {
        alert(err.error || 'You have reached your listing limit.');
        return;
      }
      if (err.code === 'DUPLICATE_TITLE' || err.code === 'DUPLICATE_DESCRIPTION' || err.code === 'DUPLICATE_MEDIA') {
        alert(err.error || 'This listing looks like a duplicate.');
        return;
      }
      alert(err.error || 'Failed to create listing');
      return;
    }
    const listing = await res.json();
    router.push('/listings/' + listing._id);
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={(e) => {
          if (uploadUi.status === 'uploading') {
            e.preventDefault();
            return;
          }
          void handleSubmit(onSubmit)(e);
        }}
        className="space-y-10"
      >
        {/* Basics */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Basics</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description <span className="text-red-500">*</span>
          </label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <RichTextEditor
                value={field.value}
                onChange={field.onChange}
                minHeight="180px"
                disabled={isUploading}
                placeholder="Describe the property in detail. Use words like luxury, modern, spacious for better SEO."
              />
            )}
          />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Listing type</label>
            <select {...register('listingType')} className="input mt-1">
              <option value={LISTING_TYPE.SALE}>For Sale</option>
              <option value={LISTING_TYPE.RENT}>For Rent</option>
              <option value={LISTING_TYPE.JOINT_VENTURE}>Joint venture</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Property types (up to {maxCategories})</label>
            <p className="mt-0.5 text-xs text-gray-500">Selected: {propertyTypesSel.length} / {maxCategories}</p>
            {maxCategories < 3 && (
              <p className="mt-0.5 text-xs text-amber-700">
                Free plan: {baseMaxCategories} category. {' '}
                <button
                  type="button"
                  onClick={() => setPaywall({ reason: 'categories' })}
                  className="font-semibold underline"
                >
                  Boost to add more
                </button>
              </p>
            )}
            {errors.propertyTypes && (
              <p className="mt-1 text-sm text-red-600">{(errors.propertyTypes as { message?: string }).message}</p>
            )}
            <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 p-2 sm:max-h-none">
              {PROPERTY_TYPES.map((t) => {
                const selected = propertyTypesSel.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => togglePropertyType(t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize sm:text-sm ${
                      selected ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {t.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={watch('listingType') === 'rent' ? 'grid gap-4 sm:grid-cols-2' : ''}>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Price (NGN) <span className="text-red-500">*</span>
            </label>
            <input type="number" {...register('price', { valueAsNumber: true })} className="input mt-1" placeholder="e.g. 50000000" required />
            {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>}
          </div>
          {watch('listingType') === 'rent' && (
            <div>
              <span className="block text-sm font-medium text-gray-700">Price period</span>
              <div className="mt-2 flex flex-wrap gap-4" role="radiogroup" aria-label="Rent period">
                {(['day', 'month', 'year'] as const).map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-2">
                    <input type="radio" {...register('rentPeriod', { required: true })} value={p} className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm">Per {p === 'day' ? 'day' : p === 'month' ? 'month' : 'year'}</span>
                  </label>
                ))}
              </div>
              {errors.rentPeriod && <p className="mt-1 text-sm text-red-600">{errors.rentPeriod.message}</p>}
            </div>
          )}
        </div>
        </section>

        {/* Location */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Location</h2>
        <LocationAddress />
        {errors.address && <p className="text-sm text-red-600">{errors.address.message}</p>}
        {errors.city && <p className="text-sm text-red-600">{errors.city.message}</p>}
        {errors.state && <p className="text-sm text-red-600">{errors.state.message}</p>}
        </section>

        {/* Property details */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Property details</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Bedrooms</label>
            <input type="number" {...register('bedrooms', { valueAsNumber: true })} className="input mt-1" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bathrooms</label>
            <input type="number" {...register('bathrooms', { valueAsNumber: true })} className="input mt-1" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Toilets</label>
            <input type="number" {...register('toilets', { valueAsNumber: true })} className="input mt-1" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Area (sqm) <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="number" {...register('area', { valueAsNumber: true })} className="input mt-1" placeholder="e.g. 120" />
          </div>
        </div>
        </section>

        {/* Media */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Images &amp; media</h2>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">Photos &amp; videos</label>
            {editId && !boostActive && (maxImages < 25 || maxVideos < 5) && (
              <button
                type="button"
                onClick={() => setPaywall({ reason: 'general' })}
                className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
              >
                Boost for more slots
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Up to {maxImages} photos (first is used in search) and {maxVideos} video{maxVideos === 1 ? '' : 's'} (MP4/WebM/MOV, max 50MB). On mobile you can pick videos from your library or record.
          </p>
          {boostBanner && (
            <p className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
              Boost active — {BOOST_PACKAGES[boostBanner.boostPackage].name} package. {maxImages} photos / {maxVideos} videos available.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="file"
              accept={LISTING_FILE_UPLOAD_ACCEPT}
              multiple
              onChange={onFileChange}
              disabled={isUploading || (images.length >= maxImages && videos.length >= maxVideos)}
              className="hidden"
              id="file-upload"
            />
            {editId && images.length >= maxImages && videos.length >= maxVideos && !isUploading ? (
              <button
                type="button"
                onClick={() => setPaywall({ reason: images.length >= maxImages ? 'images' : 'videos' })}
                className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                Upgrade to add more
              </button>
            ) : (
              <label htmlFor="file-upload" className="cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Choose photos / videos
              </label>
            )}
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
              onClick={() => {
                if (images.length >= maxImages) {
                  if (editId) setPaywall({ reason: 'images' });
                  return;
                }
                onCameraCapture();
              }}
              disabled={isUploading}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
              onClick={() => {
                if (videos.length >= maxVideos) {
                  if (editId) setPaywall({ reason: 'videos' });
                  return;
                }
                videoPickInputRef.current?.click();
              }}
              disabled={isUploading}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
              onClick={() => {
                if (videos.length >= maxVideos) {
                  if (editId) setPaywall({ reason: 'videos' });
                  return;
                }
                videoRecordInputRef.current?.click();
              }}
              disabled={isUploading}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Record video
            </button>
            <span className="self-center text-xs text-gray-500">
              {images.length} / {maxImages} photos · {videos.length} / {maxVideos} videos
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">You can select several files at once, or use the camera repeatedly for more photos.</p>
          {uploadUi.status === 'uploading' && (
            <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
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
                  className="h-full bg-primary-600 transition-[width] duration-200"
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
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((img, index) => (
              <div key={img.public_id} className="relative flex flex-col items-center">
                <div className="relative h-20 w-20">
                  <img src={img.url} alt="" className="h-full w-full rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((i) => i.public_id !== img.public_id))}
                    className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-1 flex gap-1">
                  <button type="button" onClick={() => moveImage(index, 'left')} disabled={index === 0} className="text-xs text-gray-600 disabled:opacity-40">←</button>
                  <button type="button" onClick={() => moveImage(index, 'right')} disabled={index === images.length - 1} className="text-xs text-gray-600 disabled:opacity-40">→</button>
                </div>
              </div>
            ))}
            {videos.map((vid, index) => (
              <div key={vid.public_id} className="relative flex flex-col items-center">
                <div className="relative h-20 w-20">
                  <video
                    src={vid.url}
                    poster={getCloudinaryVideoThumbnailUrl(vid) ?? undefined}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full rounded object-cover"
                  />
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-0.5 text-[9px] text-white">Video</span>
                  <button
                    type="button"
                    onClick={() => setVideos((prev) => prev.filter((v) => v.public_id !== vid.public_id))}
                    className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-1 flex gap-1">
                  <button type="button" onClick={() => moveVideo(index, 'left')} disabled={index === 0} className="text-xs text-gray-600 disabled:opacity-40">←</button>
                  <button type="button" onClick={() => moveVideo(index, 'right')} disabled={index === videos.length - 1} className="text-xs text-gray-600 disabled:opacity-40">→</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        </section>

        {/* Amenities */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Amenities</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">Features</label>
          <p className="mt-1 text-xs text-gray-500">Choose popular amenities or add your own below.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {POPULAR_AMENITIES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAmenity(a)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${amenityList.includes(a) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {a}
              </button>
            ))}
          </div>
          <input {...register('amenities')} placeholder="Or type custom (comma-separated)" className="input mt-2" />
        </div>
        </section>

        {/* Title & contact */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Title &amp; contact</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Title (SEO) <span className="text-red-500">*</span>
          </label>
          <p className="mt-1 text-xs text-gray-500">Click the field to auto-generate a title from your listing details, then edit if needed.</p>
          <input
            {...register('title')}
            onFocus={() => { if (!watched.title?.trim()) generateTitle(); }}
            className="input mt-2"
            placeholder="Click here to generate from details, or type your own (e.g. 3-Bedroom Apartment for Sale in Lekki, Lagos)"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Contact (optional)</label>
          <p className="mt-1 text-xs text-gray-500">
            Choose whether viewers will see your account contact (Author) or the contact details you enter on this listing.
          </p>
          <div className="mt-3 flex flex-wrap gap-4" role="radiogroup" aria-label="Contact source">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                value="author"
                {...register('contactSource')}
                className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-800">Author contact</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                value="listing"
                {...register('contactSource')}
                className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-800">Listing contact</span>
            </label>
          </div>
          <div className="mt-2 space-y-2">
            <input {...register('agentName')} placeholder="Agent name" className="input" />
            <input {...register('agentPhone')} placeholder="Phone" className="input" />
            <input {...register('agentEmail')} type="email" placeholder="Email" className="input" />
          </div>
          {errors.contactSource && <p className="mt-1 text-sm text-red-600">{errors.contactSource.message}</p>}
          {errors.agentPhone && <p className="mt-1 text-sm text-red-600">{errors.agentPhone.message}</p>}
        </div>
        </section>

        {/* Actions */}
        <section className="flex flex-wrap gap-4 pt-4 border-t border-gray-200">
          <button
            type="submit"
            onClick={() => setValue('status', 'draft')}
            disabled={isSubmitting || isUploading}
            className="btn-secondary"
          >
            Save as draft
          </button>
          <button
            type="submit"
            onClick={() => setValue('status', 'active')}
            disabled={isSubmitting || isUploading}
            className="btn-primary min-w-[120px]"
          >
            {isSubmitting ? 'Publishing...' : 'Publish'}
          </button>
        </section>
      </form>
      <BoostPaywallModal
        open={!!paywall}
        reason={paywall?.reason}
        listingId={editId}
        onClose={() => setPaywall(null)}
        onPaid={onPaywallSuccess}
      />
    </FormProvider>
  );
}
