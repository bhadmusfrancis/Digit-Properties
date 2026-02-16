'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { NIGERIAN_STATES, PROPERTY_TYPES } from '@/lib/constants';

export function ListingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listingType, setListingType] = useState(searchParams.get('listingType') || '');
  const [propertyType, setPropertyType] = useState(searchParams.get('propertyType') || '');
  const [state, setState] = useState(searchParams.get('state') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');

  function apply() {
    const params = new URLSearchParams();
    if (listingType) params.set('listingType', listingType);
    if (propertyType) params.set('propertyType', propertyType);
    if (state) params.set('state', state);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (q) params.set('q', q);
    router.push(`/listings?${params.toString()}`);
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <input
          type="text"
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input"
        />
        <select value={listingType} onChange={(e) => setListingType(e.target.value)} className="input">
          <option value="">All types</option>
          <option value="sale">For Sale</option>
          <option value="rent">For Rent</option>
        </select>
        <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="input">
          <option value="">Property type</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} className="input">
          <option value="">State</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Min price (NGN)"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className="input"
        />
        <input
          type="number"
          placeholder="Max price (NGN)"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="input"
        />
      </div>
      <button onClick={apply} className="btn-primary mt-4">
        Apply filters
      </button>
    </div>
  );
}
