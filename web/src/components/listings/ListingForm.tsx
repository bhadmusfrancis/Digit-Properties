'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NIGERIAN_STATES, PROPERTY_TYPES, POPULAR_AMENITIES } from '@/lib/constants';
import { LocationAddress } from '@/components/listings/LocationAddress';
import { generateListingTitle } from '@/lib/listing-title';

const schema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  listingType: z.enum(['sale', 'rent']),
  propertyType: z.enum(PROPERTY_TYPES as unknown as [string, ...string[]]),
  price: z.number().positive(),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.enum(NIGERIAN_STATES as unknown as [string, ...string[]]),
  suburb: z.string().optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  toilets: z.number().int().min(0).optional(),
  area: z.number().positive().optional(),
  amenities: z.string().optional(),
  tags: z.string().optional(),
  agentName: z.string().optional(),
  agentPhone: z.string().optional(),
  agentEmail: z.string().email().optional().or(z.literal('')),
  rentPeriod: z.enum(['day', 'month', 'year']).optional(),
  leaseDuration: z.string().optional(),
  status: z.enum(['draft', 'active']).optional(),
}).refine((d) => d.listingType !== 'rent' || !!d.rentPeriod, {
  message: 'Rent period is required for rental listings',
  path: ['rentPeriod'],
});

type FormData = z.infer<typeof schema>;

export function ListingForm() {
  const router = useRouter();
  const [images, setImages] = useState<{ url: string; public_id: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      listingType: 'sale',
      status: 'draft',
      bedrooms: 0,
      bathrooms: 0,
      toilets: 0,
      state: NIGERIAN_STATES[0],
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = methods;

  const watched = watch();

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
      propertyType: watched.propertyType,
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
    setUploading(true);
    for (let i = 0; i < Math.min(files.length, 10 - images.length); i++) {
      const form = new FormData();
      form.append('file', files[i]);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) setImages((prev) => [...prev, { url: data.url, public_id: data.public_id }]);
    }
    setUploading(false);
    e.target.value = '';
  }

  async function onCameraCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const track = stream.getTracks()[0];
      track.stop();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (file) {
          setUploading(true);
          const form = new FormData();
          form.append('file', file);
          fetch('/api/upload', { method: 'POST', body: form })
            .then((r) => r.json())
            .then((data) => {
              if (data.url) setImages((prev) => [...prev, { url: data.url, public_id: data.public_id }]);
            })
            .finally(() => setUploading(false));
        }
      };
      input.click();
    } catch {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (file) {
          setUploading(true);
          const form = new FormData();
          form.append('file', file);
          fetch('/api/upload', { method: 'POST', body: form })
            .then((r) => r.json())
            .then((data) => {
              if (data.url) setImages((prev) => [...prev, { url: data.url, public_id: data.public_id }]);
            })
            .finally(() => setUploading(false));
        }
      };
      input.click();
    }
  }

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const newOrder = [...images];
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setImages(newOrder);
  };

  async function onSubmit(data: FormData) {
    const location: Record<string, unknown> = {
      address: data.address,
      city: data.city,
      state: data.state,
    };
    if (data.suburb) location.suburb = data.suburb;
    if (data.coordinates) location.coordinates = data.coordinates;

    const payload = {
      ...data,
      location,
      amenities: data.amenities ? data.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [],
      tags: data.tags ? data.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      images,
    };
    delete (payload as Record<string, unknown>).address;
    delete (payload as Record<string, unknown>).city;
    delete (payload as Record<string, unknown>).state;
    delete (payload as Record<string, unknown>).suburb;
    delete (payload as Record<string, unknown>).coordinates;
    delete (payload as Record<string, unknown>).amenities;
    delete (payload as Record<string, unknown>).tags;

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to create listing');
      return;
    }
    const listing = await res.json();
    router.push('/listings/' + listing._id);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea {...register('description')} rows={5} className="input mt-1" placeholder="Describe the property in detail. Use words like luxury, modern, spacious for better SEO." />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Listing type</label>
            <select {...register('listingType')} className="input mt-1">
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Property type</label>
            <select {...register('propertyType')} className="input mt-1">
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={watch('listingType') === 'rent' ? 'grid gap-4 sm:grid-cols-2' : ''}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Price (NGN)</label>
            <input type="number" {...register('price', { valueAsNumber: true })} className="input mt-1" />
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

        <LocationAddress />
        {errors.address && <p className="text-sm text-red-600">{errors.address.message}</p>}
        {errors.city && <p className="text-sm text-red-600">{errors.city.message}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Bedrooms</label>
            <input type="number" {...register('bedrooms', { valueAsNumber: true })} className="input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bathrooms</label>
            <input type="number" {...register('bathrooms', { valueAsNumber: true })} className="input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Toilets</label>
            <input type="number" {...register('toilets', { valueAsNumber: true })} className="input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Area (sqm)</label>
            <input type="number" {...register('area', { valueAsNumber: true })} className="input mt-1" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Images &amp; media</label>
          <p className="mt-1 text-xs text-gray-500">
            Recommended for SEO: 1200×630 or 1920×1080, JPEG/PNG/WebP, max 10MB. First image is used in search previews.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onFileChange}
              disabled={uploading || images.length >= 10}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Choose files
            </label>
            <button type="button" onClick={onCameraCapture} disabled={uploading || images.length >= 10} className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Use camera
            </button>
          </div>
          {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
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
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Amenities</label>
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

        <div>
          <label className="block text-sm font-medium text-gray-700">Title (SEO)</label>
          <p className="mt-1 text-xs text-gray-500">Generate from listing details, then edit if needed.</p>
          <div className="mt-2 flex gap-2">
            <input {...register('title')} className="input flex-1" placeholder="e.g. 3-Bedroom Apartment for Sale in Lekki, Lagos" />
            <button type="button" onClick={generateTitle} className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              Generate title
            </button>
          </div>
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Contact (optional)</label>
          <div className="mt-2 space-y-2">
            <input {...register('agentName')} placeholder="Agent name" className="input" />
            <input {...register('agentPhone')} placeholder="Phone" className="input" />
            <input {...register('agentEmail')} type="email" placeholder="Email" className="input" />
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" onClick={() => setValue('status', 'draft')} disabled={isSubmitting} className="btn-secondary">
            Save as draft
          </button>
          <button type="submit" onClick={() => setValue('status', 'active')} disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
