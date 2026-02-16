'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface SearchFiltersProps {
  states: string[];
  propertyTypes: string[];
}

export function SearchFilters({ states, propertyTypes }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      router.push(`/listings?${next.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <form
      className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const q = (form.elements.namedItem('q') as HTMLInputElement)?.value;
        update('q', q?.trim() || null);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Search</label>
          <input
            name="q"
            type="text"
            placeholder="Keywords..."
            className="input mt-1"
            defaultValue={searchParams.get('q') || ''}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Type</label>
          <select
            className="input mt-1"
            value={searchParams.get('listingType') || ''}
            onChange={(e) => update('listingType', e.target.value || null)}
          >
            <option value="">All</option>
            <option value="sale">For Sale</option>
            <option value="rent">For Rent</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Property</label>
          <select
            className="input mt-1"
            value={searchParams.get('propertyType') || ''}
            onChange={(e) => update('propertyType', e.target.value || null)}
          >
            <option value="">All</option>
            {propertyTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">State</label>
          <select
            className="input mt-1"
            value={searchParams.get('state') || ''}
            onChange={(e) => update('state', e.target.value || null)}
          >
            <option value="">All</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Min Price (NGN)</label>
          <input
            type="number"
            placeholder="0"
            className="input mt-1"
            value={searchParams.get('minPrice') || ''}
            onChange={(e) => update('minPrice', e.target.value || null)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Max Price (NGN)</label>
          <input
            type="number"
            placeholder="Any"
            className="input mt-1"
            value={searchParams.get('maxPrice') || ''}
            onChange={(e) => update('maxPrice', e.target.value || null)}
          />
        </div>
        {searchParams.get('listingType') === 'rent' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Rent period</label>
            <select
              className="input mt-1"
              value={searchParams.get('rentPeriod') || ''}
              onChange={(e) => update('rentPeriod', e.target.value || null)}
            >
              <option value="">All</option>
              <option value="day">Per day</option>
              <option value="month">Per month</option>
              <option value="year">Per year</option>
            </select>
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-4">
        <button type="submit" className="btn-primary">
          Search
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.push('/listings')}
        >
          Clear
        </button>
      </div>
    </form>
  );
}
