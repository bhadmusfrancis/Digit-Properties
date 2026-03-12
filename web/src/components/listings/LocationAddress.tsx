'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { NIGERIAN_STATES } from '@/lib/constants';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(
  () => import('@/components/listings/MapPicker').then((m) => m.MapPicker),
  { ssr: false }
);

type GeocodeResult = {
  address: string;
  city: string;
  state: string;
  suburb: string;
  lat: number;
  lng: number;
};

export function LocationAddress() {
  const { register, setValue, control } = useFormContext();
  const coordinates = useWatch({ control, name: 'coordinates', defaultValue: undefined }) as { lat: number; lng: number } | undefined;
  const state = useWatch({ control, name: 'state', defaultValue: '' }) as string;
  const city = useWatch({ control, name: 'city', defaultValue: '' }) as string;
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  /** When user selects state and city, geocode and move map to that area. */
  const stateCityGeocodeRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const s = (state || '').trim();
    const c = (city || '').trim();
    if (!s || !c || c.length < 2) return;
    if (stateCityGeocodeRef.current) clearTimeout(stateCityGeocodeRef.current);
    stateCityGeocodeRef.current = setTimeout(() => {
      stateCityGeocodeRef.current = undefined;
      const query = `${c}, ${s}, Nigeria`;
      fetch('/api/geocode?q=' + encodeURIComponent(query))
        .then((res) => res.json())
        .then((data) => {
          const results = data.results || [];
          if (results.length > 0) {
            const first = results[0];
            setValue('coordinates', { lat: first.lat, lng: first.lng }, { shouldValidate: false, shouldDirty: true });
          }
        })
        .catch(() => {});
    }, 400);
    return () => {
      if (stateCityGeocodeRef.current) clearTimeout(stateCityGeocodeRef.current);
    };
  }, [state, city, setValue]);

  const applyResult = useCallback(
    (r: GeocodeResult) => {
      setValue('address', r.address || '', { shouldValidate: true });
      setValue('city', r.city || '', { shouldValidate: true });
      let stateVal = (r.state || '').trim();
      if (stateVal.toLowerCase() === 'federal capital territory') stateVal = 'FCT';
      const stateMatch = NIGERIAN_STATES.find((s) => s.toLowerCase() === stateVal.toLowerCase());
      setValue('state', stateMatch || NIGERIAN_STATES[0], { shouldValidate: true });
      setValue('suburb', r.suburb || '', { shouldValidate: true });
      setValue('coordinates', { lat: r.lat, lng: r.lng }, { shouldValidate: true });
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [setValue]
  );

  const fetchSuggestions = useCallback((query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    fetch('/api/geocode?q=' + encodeURIComponent(query))
      .then((res) => res.json())
      .then((data) => {
        const results = data.results || [];
        setSuggestions(results);
        setShowSuggestions(true);
        // Map updates only when user selects a suggestion or blurs the address field
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  /** Geocode current address string and move map marker (e.g. on blur when user typed but didn't select). */
  const geocodeAddressForMap = useCallback(
    (addressValue: string) => {
      const trimmed = addressValue.trim();
      if (trimmed.length < 5) return;
      setLoading(true);
      fetch('/api/geocode?q=' + encodeURIComponent(trimmed))
        .then((res) => res.json())
        .then((data) => {
          const results = data.results || [];
          if (results.length > 0) {
            const first = results[0];
            setValue('coordinates', { lat: first.lat, lng: first.lng }, { shouldValidate: false, shouldDirty: true });
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [setValue]
  );

  const onAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 280);
  };

  const onAddressBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    if (value.length >= 5) geocodeAddressForMap(value);
  };

  const useGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fetch('/api/geocode?lat=' + latitude + '&lon=' + longitude)
          .then((res) => res.json())
          .then((data) => {
            if (data.address !== undefined) applyResult(data);
            else alert('Could not resolve address for this location.');
          })
          .catch(() => alert('Failed to get address from location.'))
          .finally(() => setGpsLoading(false));
      },
      () => {
        alert('Could not get your location. Check permissions.');
        setGpsLoading(false);
      }
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Address <span className="text-red-500">*</span></label>
        <div className="mt-1 flex gap-2">
          <div className="relative flex-1">
            <input
              {...register('address')}
              onChange={(e) => {
                register('address').onChange(e);
                onAddressChange(e);
              }}
              onBlur={onAddressBlur}
              type="text"
              placeholder="Type address, then select from dropdown or click away to update map"
              className="input"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white py-1 shadow">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => applyResult(s)}
                    >
                      {s.address}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                Searching...
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={useGps}
            disabled={gpsLoading}
            className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            title="Use current location"
          >
            GPS
          </button>
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            title="Pick on map"
          >
            Map
          </button>
        </div>
      </div>

      {showMap && (
        <div className="rounded border border-gray-200 bg-gray-50 p-2">
          <p className="mb-2 text-sm text-gray-600">
            Click on the map to set property location. Address will be filled automatically.
          </p>
          <MapPicker
            initialLat={coordinates?.lat}
            initialLng={coordinates?.lng}
            onPick={(lat, lng) => {
              fetch('/api/geocode?lat=' + lat + '&lon=' + lng)
                .then((res) => res.json())
                .then((data) => {
                  if (data.address !== undefined) applyResult(data);
                })
                .catch(() => {});
            }}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">State <span className="text-red-500">*</span></label>
          <select {...register('state')} className="input mt-1 w-full" required>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">City <span className="text-red-500">*</span></label>
          <input
            {...register('city')}
            list="listing-cities-list"
            className="input mt-1 w-full"
            placeholder={state ? 'Select or type city' : 'Select state first'}
            required
          />
          <datalist id="listing-cities-list">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Suburb / Area (optional)</label>
        <input
          {...register('suburb')}
          list="listing-suburbs-list"
          className="input mt-1 w-full"
          placeholder={state && city ? 'Select or type suburb/area' : 'Select state & city first'}
        />
        <datalist id="listing-suburbs-list">
          {suburbs.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
