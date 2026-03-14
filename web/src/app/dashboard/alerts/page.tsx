'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import {
  LISTING_TYPE,
  RENT_PERIOD,
  PROPERTY_TYPES,
  NIGERIAN_STATES,
} from '@/lib/constants';

type AlertFilters = {
  listingType?: string;
  propertyType?: string;
  state?: string;
  city?: string;
  suburb?: string;
  bedrooms?: number;
  bathrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  rentPeriod?: string;
};

type AlertItem = {
  _id: string;
  name: string;
  filters: AlertFilters;
  notifyEmail: boolean;
  notifyPush: boolean;
  createdAt: string;
};

export default function PropertyAlertsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [listingType, setListingType] = useState<string>('');
  const [propertyType, setPropertyType] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [city, setCity] = useState('');
  const [suburb, setSuburb] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('');
  const [bathrooms, setBathrooms] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [rentPeriod, setRentPeriod] = useState<string>('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetch('/api/alerts').then((r) => r.json()),
  });

  const { data: citiesData } = useQuery({
    queryKey: ['locations/cities', state],
    queryFn: () => fetch(`/api/locations/cities?state=${encodeURIComponent(state)}`).then((r) => r.json()),
    enabled: !!state,
  });
  const cities = (citiesData?.cities ?? []) as string[];

  const { data: suburbsData } = useQuery({
    queryKey: ['locations/suburbs', state, city],
    queryFn: () =>
      fetch(
        `/api/locations/suburbs?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}`
      ).then((r) => r.json()),
    enabled: !!state && !!city,
  });
  const suburbs = (suburbsData?.suburbs ?? []) as string[];

  useEffect(() => {
    if (!cities.includes(city)) setCity('');
  }, [cities, city]);
  // Suburb: user can pick from list OR type their own (no clearing when not in list)

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d)))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setName('');
      setListingType('');
      setPropertyType('');
      setState('');
      setCity('');
      setSuburb('');
      setBedrooms('');
      setBathrooms('');
      setMinPrice('');
      setMaxPrice('');
      setRentPeriod('');
    },
  });

  function handleCreate() {
    const filters: AlertFilters = {};
    if (listingType) filters.listingType = listingType;
    if (propertyType) filters.propertyType = propertyType;
    if (state) filters.state = state;
    if (city.trim()) filters.city = city.trim();
    if (suburb) filters.suburb = suburb;
    const b = parseInt(bedrooms, 10);
    if (!Number.isNaN(b) && b >= 0) filters.bedrooms = b;
    const b2 = parseInt(bathrooms, 10);
    if (!Number.isNaN(b2) && b2 >= 0) filters.bathrooms = b2;
    const min = parseInt(minPrice, 10);
    if (!Number.isNaN(min) && min >= 0) filters.minPrice = min;
    const max = parseInt(maxPrice, 10);
    if (!Number.isNaN(max) && max >= 0) filters.maxPrice = max;
    if (listingType === 'rent' && rentPeriod) filters.rentPeriod = rentPeriod;

    if (!name.trim()) {
      createMutation.reset();
      return;
    }
    createMutation.mutate({
      name: name.trim() || 'My property alert',
      filters,
      notifyEmail,
      notifyPush,
    });
  }

  async function handleDelete(id: string) {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
  }

  const filterSummary = (f: AlertFilters) => {
    const parts: string[] = [];
    if (f.listingType) parts.push(f.listingType === 'rent' ? 'Rent' : 'Sale');
    if (f.propertyType) parts.push(f.propertyType);
    if (f.state) parts.push(f.state);
    if (f.city) parts.push(f.city);
    if (f.suburb) parts.push(f.suburb);
    if (f.bedrooms != null) parts.push(`${f.bedrooms}+ beds`);
    if (f.minPrice != null || f.maxPrice != null) {
      const range = [f.minPrice != null ? `₦${f.minPrice.toLocaleString()}` : '', f.maxPrice != null ? `₦${f.maxPrice.toLocaleString()}` : ''].filter(Boolean).join(' – ');
      if (range) parts.push(range);
    }
    if (f.rentPeriod) parts.push(`/${f.rentPeriod}`);
    return parts.length ? parts.join(' · ') : 'Any';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Property Alerts</h1>
      <p className="mt-1 text-gray-600">
        Get email and push notifications when new listings match your criteria.
      </p>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900">Create alert</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Alert name</label>
        <input
          type="text"
              placeholder="e.g. Lagos 3-bed for rent"
          value={name}
          onChange={(e) => setName(e.target.value)}
              className="input mt-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Listing type</label>
            <select
              value={listingType}
              onChange={(e) => setListingType(e.target.value)}
              className="input mt-1 w-full"
            >
              <option value="">Any</option>
              <option value={LISTING_TYPE.SALE}>Sale</option>
              <option value={LISTING_TYPE.RENT}>Rent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Property type</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="input mt-1 w-full"
            >
              <option value="">Any</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">State</label>
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setCity('');
                setSuburb('');
              }}
              className="input mt-1 w-full"
            >
              <option value="">Any</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">City</label>
            <select
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setSuburb('');
              }}
              className="input mt-1 w-full"
              disabled={!state}
            >
              <option value="">Any</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {state && !cities.length && (
              <p className="mt-1 text-xs text-gray-500">No cities found for this state yet.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Suburb / Area</label>
            <input
              type="text"
              list="alerts-suburb-list"
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              placeholder={state && city ? 'Pick one or type your area' : 'Select state & city first'}
              className="input mt-1 w-full"
              disabled={!state || !city}
            />
            <datalist id="alerts-suburb-list">
              {suburbs.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {state && city && (
              <p className="mt-1 text-xs text-gray-500">
                {suburbs.length ? 'Choose from the list or type another suburb/area.' : 'No preset suburbs for this city — type your area above.'}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Min. bedrooms</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="input mt-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Min. bathrooms (optional)</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              className="input mt-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Min price (₦)</label>
            <input
              type="number"
              min={0}
              placeholder="Optional"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="input mt-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max price (₦)</label>
            <input
              type="number"
              min={0}
              placeholder="Optional"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="input mt-1 w-full"
            />
          </div>
          {listingType === 'rent' && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Rent period</label>
              <select
                value={rentPeriod}
                onChange={(e) => setRentPeriod(e.target.value)}
                className="input mt-1 w-full max-w-xs"
              >
                <option value="">Any</option>
                <option value={RENT_PERIOD.DAY}>Per day</option>
                <option value={RENT_PERIOD.MONTH}>Per month</option>
                <option value={RENT_PERIOD.YEAR}>Per year</option>
              </select>
            </div>
          )}
          <div className="sm:col-span-2 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Email me when there&apos;s a match</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyPush}
                onChange={(e) => setNotifyPush(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Push notification (when available)</span>
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={createMutation.isPending || !name.trim()}
          className="btn-primary mt-4"
        >
          {createMutation.isPending ? 'Creating…' : 'Create alert'}
        </button>
        {createMutation.isError && (
          <p className="mt-2 text-sm text-red-600">{(createMutation.error as { error?: string })?.error ?? 'Failed to create alert'}</p>
        )}
      </div>

      <div className="mt-8">
        <h2 className="font-semibold text-gray-900">Your alerts</h2>
        {isLoading ? (
          <div className="mt-4 h-24 animate-pulse rounded bg-gray-100" />
        ) : (
          <ul className="mt-4 space-y-2">
            {(alerts as AlertItem[]).map((a) => (
              <li
                key={a._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div>
                  <span className="font-medium text-gray-900">{a.name}</span>
                  <p className="mt-0.5 text-sm text-gray-500">{filterSummary(a.filters)}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {a.notifyEmail && 'Email'}
                    {a.notifyEmail && a.notifyPush && ' · '}
                    {a.notifyPush && 'Push'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(a._id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete
                </button>
              </li>
            ))}
            {(!alerts || (alerts as AlertItem[]).length === 0) && (
              <li className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-gray-500">
                No property alerts yet. Create one above to get notified when new listings match your criteria.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
