'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NIGERIAN_STATES, PROPERTY_TYPES } from '@/lib/constants';

const schema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  listingType: z.enum(['sale', 'rent']),
  propertyType: z.enum(PROPERTY_TYPES as unknown as [string, ...string[]]),
  price: z.number().positive(),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.enum(NIGERIAN_STATES as unknown as [string, ...string[]]),
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { listingType: 'sale', status: 'draft', bedrooms: 0, bathrooms: 0, toilets: 0 },
  });

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
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      location: { address: data.address, city: data.city, state: data.state },
      amenities: data.amenities ? data.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [],
      tags: data.tags ? data.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      images,
    };
    delete (payload as Record<string, unknown>).address;
    delete (payload as Record<string, unknown>).city;
    delete (payload as Record<string, unknown>).state;
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
    router.push(`/listings/${listing._id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Title</label>
        <input {...register('title')} className="input mt-1" />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea {...register('description')} rows={5} className="input mt-1" />
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
                  <input
                    type="radio"
                    {...register('rentPeriod', { required: true })}
                    value={p}
                    className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">Per {p === 'day' ? 'day' : p === 'month' ? 'month' : 'year'}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">Price is per selected period</p>
            {errors.rentPeriod && <p className="mt-1 text-sm text-red-600">{errors.rentPeriod.message}</p>}
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <input {...register('address')} className="input mt-1" />
        {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address?.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input {...register('city')} className="input mt-1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">State</label>
          <select {...register('state')} className="input mt-1">
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
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
        <label className="block text-sm font-medium text-gray-700">Images</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onFileChange}
          disabled={uploading || images.length >= 10}
          className="mt-1"
        />
        {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.public_id} className="relative h-20 w-20">
              <img src={img.url} alt="" className="h-full w-full rounded object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((i) => i.public_id !== img.public_id))}
                className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Amenities (comma-separated)</label>
        <input {...register('amenities')} placeholder="Pool, Gym, Parking" className="input mt-1" />
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
        <button
          type="submit"
          onClick={() => setValue('status', 'draft')}
          disabled={isSubmitting}
          className="btn-secondary"
        >
          Save as draft
        </button>
        <button
          type="submit"
          onClick={() => setValue('status', 'active')}
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? 'Publishing...' : 'Publish'}
        </button>
      </div>
    </form>
  );
}
