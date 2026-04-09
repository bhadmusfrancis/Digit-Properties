'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { NIGERIAN_STATES } from '@/lib/constants';
import { loadGoogleMapsApi } from '@/lib/google-maps-client';
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

type PlaceSuggestion = {
  id: string;
  label: string;
  placeId?: string;
  mainText?: string;
  secondaryText?: string;
};

type GoogleMapsLike = typeof globalThis & {
  google?: {
    maps?: {
      places?: {
        AutocompleteService?: new () => {
          getPlacePredictions: (
            req: { input: string },
            cb: (
              predictions: Array<{
                place_id?: string;
                description?: string;
                structured_formatting?: { main_text?: string; secondary_text?: string };
              }> | null
            ) => void
          ) => void;
        };
      };
    };
  };
};

function normalizeSearchText(s: string): string {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s,.-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function matchesTypedPrefix(label: string, query: string): boolean {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(label);
  if (!q || !t) return false;
  const qTokens = q.split(' ').filter(Boolean);
  if (!qTokens.length) return false;
  if (qTokens.length === 1) return t.includes(qTokens[0]);
  const head = qTokens.slice(0, -1).join(' ');
  const tail = qTokens[qTokens.length - 1];
  if (head && !t.includes(head)) return false;
  if (!tail) return true;
  // Require final typed fragment to align with a word boundary (e.g. "es" -> "estate")
  const boundary = new RegExp(`(^|[\\s,.-])${tail}`);
  return boundary.test(t);
}

function scoreSuggestion(query: string, s: PlaceSuggestion): number {
  const q = normalizeSearchText(query);
  const main = normalizeSearchText(s.mainText || '');
  const secondary = normalizeSearchText(s.secondaryText || '');
  const label = normalizeSearchText(s.label || `${main} ${secondary}`);
  let score = 0;

  // Strong relevance to typed text.
  if (main.startsWith(q)) score += 80;
  else if (label.startsWith(q)) score += 60;
  else if (matchesTypedPrefix(label, q)) score += 40;
  else if (label.includes(q)) score += 20;

  // Soft local bias: prioritize Lagos/Nigeria first, never exclude global.
  if (secondary.includes('lagos') || main.includes('lagos') || label.includes('lagos')) score += 18;
  if (secondary.includes('lekki') || main.includes('lekki') || label.includes('lekki')) score += 12;
  if (secondary.includes('nigeria') || label.includes('nigeria')) score += 8;

  return score;
}

function sortWithLocalBias(query: string, items: PlaceSuggestion[]): PlaceSuggestion[] {
  return [...items].sort((a, b) => scoreSuggestion(query, b) - scoreSuggestion(query, a));
}

function buildBackoffQueries(query: string): string[] {
  const q = query.trim().replace(/\s+/g, ' ');
  if (!q) return [];
  const out: string[] = [q];
  const tokens = q.split(' ').filter(Boolean);
  while (tokens.length > 1) {
    tokens.pop();
    const next = tokens.join(' ').trim();
    if (next.length >= 3 && !out.includes(next)) out.push(next);
  }
  return out;
}

function isNigeriaText(text: string): boolean {
  const t = normalizeSearchText(text);
  return t.includes(' nigeria') || t.endsWith('nigeria') || t.includes(', nigeria');
}

function scoreNigeriaPreference(query: string, candidate: { label?: string; mainText?: string; secondaryText?: string }): number {
  const label = normalizeSearchText(candidate.label || '');
  const main = normalizeSearchText(candidate.mainText || '');
  const secondary = normalizeSearchText(candidate.secondaryText || '');
  const q = normalizeSearchText(query);
  let score = 0;
  if (isNigeriaText(label) || isNigeriaText(secondary)) score += 100;
  if (label.includes('lagos') || secondary.includes('lagos') || main.includes('lagos')) score += 30;
  if (label.includes('lekki') || secondary.includes('lekki') || main.includes('lekki')) score += 20;
  if (q && (label.includes(q) || main.includes(q))) score += 10;
  return score;
}

export function LocationAddress() {
  const { register, setValue, control } = useFormContext();
  const addressField = register('address');
  const coordinates = useWatch({ control, name: 'coordinates', defaultValue: undefined }) as { lat: number; lng: number } | undefined;
  const state = useWatch({ control, name: 'state', defaultValue: '' }) as string;
  const city = useWatch({ control, name: 'city', defaultValue: '' }) as string;
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showMap, setShowMap] = useState(true);
  /** User placed the pin on the map; do not move it when address/city/suburb change until refresh. */
  const [mapUserPinned, setMapUserPinned] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const blurHideRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const sessionTokenRef = useRef('');
  const resolveRunIdRef = useRef(0);
  const clientAutoServiceRef = useRef<{
    getPlacePredictions: (
      req: { input: string },
      cb: (
        predictions: Array<{
          place_id?: string;
          description?: string;
          structured_formatting?: { main_text?: string; secondary_text?: string };
        }> | null
      ) => void
    ) => void;
  } | null>(null);
  const hasClientMapsKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());

  const nextSessionToken = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const fetchClientSuggestions = useCallback(
    async (query: string): Promise<PlaceSuggestion[]> => {
      if (!hasClientMapsKey) return [];
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
      if (!apiKey) return [];
      try {
        if (!clientAutoServiceRef.current) {
          await loadGoogleMapsApi(apiKey, ['places']);
          const g = globalThis as GoogleMapsLike;
          const AutoService = g.google?.maps?.places?.AutocompleteService;
          if (AutoService) clientAutoServiceRef.current = new AutoService();
        }
        if (!clientAutoServiceRef.current) return [];
        return await new Promise<PlaceSuggestion[]>((resolve) => {
          clientAutoServiceRef.current?.getPlacePredictions(
            { input: query },
            (predictions) => {
              const out = (predictions || [])
                .map((p, i) => ({
                  id: `${p.place_id || 'g'}-${i}`,
                  placeId: p.place_id || '',
                  label: p.description || '',
                  mainText: p.structured_formatting?.main_text || '',
                  secondaryText: p.structured_formatting?.secondary_text || '',
                }))
                .filter((x) => x.label)
                .slice(0, 8);
              resolve(out);
            }
          );
        });
      } catch {
        return [];
      }
    },
    [hasClientMapsKey]
  );

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
    if (mapUserPinned) return;
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
  }, [state, city, setValue, mapUserPinned]);

  const applyAddressFieldsOnly = useCallback(
    (r: GeocodeResult) => {
      setValue('address', r.address || '', { shouldValidate: true });
      setValue('city', r.city || '', { shouldValidate: true });
      let stateVal = (r.state || '').trim();
      if (stateVal.toLowerCase() === 'federal capital territory') stateVal = 'FCT';
      const stateMatch = NIGERIAN_STATES.find((s) => s.toLowerCase() === stateVal.toLowerCase());
      setValue('state', stateMatch || NIGERIAN_STATES[0], { shouldValidate: true });
      setValue('suburb', r.suburb || '', { shouldValidate: true });
    },
    [setValue]
  );

  const applyResult = useCallback(
    (r: GeocodeResult) => {
      setMapUserPinned(false);
      applyAddressFieldsOnly(r);
      setValue('coordinates', { lat: r.lat, lng: r.lng }, { shouldValidate: true });
      setSuggestions([]);
      setPlaceSuggestions([]);
      setHighlightedIndex(-1);
      setShowSuggestions(false);
      sessionTokenRef.current = '';
    },
    [setValue, applyAddressFieldsOnly]
  );

  const fetchSuggestions = useCallback(async (query: string) => {
    const q = query.trim();
    const fallbackPrefixQuery = q.split(' ').slice(0, -1).join(' ').trim();
    const filterByTypedPrefix = (items: PlaceSuggestion[]) =>
      sortWithLocalBias(
        q,
        items.filter((s) => matchesTypedPrefix(s.label || `${s.mainText || ''} ${s.secondaryText || ''}`, q))
      );

    const fetchGeocodeFallback = async () => {
      setPlaceSuggestions([]);
      const fallbackQueries = buildBackoffQueries(q);
      for (const fq of fallbackQueries) {
        try {
          const res = await fetch('/api/geocode?q=' + encodeURIComponent(fq));
          if (!res.ok) continue;
          const data = await res.json();
          const results = Array.isArray(data.results) ? (data.results as GeocodeResult[]) : [];
          if (results.length > 0) {
            setSuggestions(results);
            setHighlightedIndex(0);
            setShowSuggestions(true);
            return;
          }
        } catch {
          // Try shorter fallback query
        }
      }
      setSuggestions([]);
      setHighlightedIndex(-1);
      setShowSuggestions(false);
    };

    const fetchQuerySuggestions = async () => {
      try {
        const res = await fetch('/api/suggest?q=' + encodeURIComponent(q));
        if (!res.ok) return false;
        const data = await res.json();
        const results = Array.isArray(data.results) ? (data.results as Array<{ id: string; label: string }>) : [];
        if (!results.length) return false;
        const mapped: PlaceSuggestion[] = results.map((r, i) => ({
          id: r.id || `qs-${i}`,
          label: r.label,
          placeId: '',
          mainText: r.label,
          secondaryText: '',
        }));
        setPlaceSuggestions(sortWithLocalBias(q, mapped));
        setSuggestions([]);
        setHighlightedIndex(0);
        setShowSuggestions(true);
        return true;
      } catch {
        return false;
      }
    };

    if (query.length < 3) {
      setSuggestions([]);
      setPlaceSuggestions([]);
      setHighlightedIndex(-1);
      setShowSuggestions(false);
      return;
    }
    setLoading(true);
    let clientResults = await fetchClientSuggestions(q);
    let filteredClientResults = filterByTypedPrefix(clientResults);
    if (!filteredClientResults.length && fallbackPrefixQuery.length >= 3) {
      clientResults = await fetchClientSuggestions(fallbackPrefixQuery);
      filteredClientResults = filterByTypedPrefix(clientResults);
    }
    if (filteredClientResults.length > 0) {
      setPlaceSuggestions(filteredClientResults);
      setSuggestions([]);
      setHighlightedIndex(0);
      setShowSuggestions(true);
      setLoading(false);
      return;
    }
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = nextSessionToken();
    }
    fetch(
      '/api/places?q=' +
        encodeURIComponent(q) +
        '&sessionToken=' +
        encodeURIComponent(sessionTokenRef.current)
    )
      .then((res) => {
        if (!res.ok) throw new Error('Places autocomplete failed');
        return res.json();
      })
      .then((data) => {
        const apiResults = Array.isArray(data.results) ? (data.results as PlaceSuggestion[]) : [];
        const filteredApiResults = filterByTypedPrefix(apiResults);
        if (!filteredApiResults.length) {
          return fetchQuerySuggestions().then((usedQuerySuggestions) => {
            if (!usedQuerySuggestions) return fetchGeocodeFallback();
          });
        }
        setPlaceSuggestions(filteredApiResults);
        setSuggestions([]);
        setHighlightedIndex(filteredApiResults.length ? 0 : -1);
        setShowSuggestions(true);
      })
      .catch(async () => {
        const usedQuerySuggestions = await fetchQuerySuggestions();
        if (!usedQuerySuggestions) await fetchGeocodeFallback();
      })
      .finally(() => setLoading(false));
  }, [fetchClientSuggestions]);

  const applyGooglePlacePrediction = useCallback(
    (p: PlaceSuggestion) => {
      const runId = ++resolveRunIdRef.current;
      if (!p.placeId) {
        setLoading(true);
        // Always populate address immediately, even while we resolve full place details.
        setValue('address', p.label || '', { shouldValidate: true, shouldDirty: true });

        const sessionToken = sessionTokenRef.current || nextSessionToken();
        const queryVariants = Array.from(
          new Set(
            [
              p.label,
              `${p.label}, Nigeria`,
              `${p.label}, Lagos, Nigeria`,
            ]
              .map((s) => s.trim())
              .filter(Boolean)
          )
        );

        const run = async () => {
          let bestResolved: GeocodeResult | null = null;
          // 1) Try resolving a concrete placeId via /api/places and then place details.
          for (const qv of queryVariants) {
            try {
              const placesRes = await fetch(
                '/api/places?q=' + encodeURIComponent(qv) + '&sessionToken=' + encodeURIComponent(sessionToken)
              );
              if (!placesRes.ok) continue;
              const placesData = await placesRes.json();
              const candidates = Array.isArray(placesData.results)
                ? (placesData.results as PlaceSuggestion[])
                : [];
              const rankedCandidates = [...candidates].sort(
                (a, b) => scoreNigeriaPreference(qv, b) - scoreNigeriaPreference(qv, a)
              );
              const placeIds = rankedCandidates
                .map((c) => c.placeId)
                .filter((id): id is string => Boolean(id));
              for (const placeId of placeIds) {
                try {
                  const detailsRes = await fetch(
                    '/api/places?placeId=' +
                      encodeURIComponent(placeId) +
                      '&sessionToken=' +
                      encodeURIComponent(sessionToken)
                  );
                  if (!detailsRes.ok) continue;
                  const details = await detailsRes.json();
                  if (details.address !== undefined) {
                    const resolved = details as GeocodeResult;
                    if (!bestResolved) bestResolved = resolved;
                    const isNgState = NIGERIAN_STATES.some(
                      (s) => s.toLowerCase() === (resolved.state || '').toLowerCase()
                    );
                    const isNgAddress = isNigeriaText(resolved.address || '');
                    if (isNgState || isNgAddress) {
                      if (runId !== resolveRunIdRef.current) return;
                      applyResult(resolved);
                      return;
                    }
                  }
                } catch {
                  // Try next placeId
                }
              }
            } catch {
              // Try next query variant
            }
          }

          // 2) Fallback to geocode with query backoff variants.
          for (const qv of queryVariants) {
            const geocodeVariants = buildBackoffQueries(qv);
            for (const gv of geocodeVariants) {
              try {
                const geocodeRes = await fetch('/api/geocode?q=' + encodeURIComponent(gv));
                if (!geocodeRes.ok) continue;
                const geocodeData = await geocodeRes.json();
                const results = Array.isArray(geocodeData.results)
                  ? (geocodeData.results as GeocodeResult[])
                  : [];
                if (results.length > 0) {
                  const ranked = [...results].sort((a, b) => {
                    const sa = scoreNigeriaPreference(gv, { label: a.address });
                    const sb = scoreNigeriaPreference(gv, { label: b.address });
                    return sb - sa;
                  });
                  const best = ranked[0];
                  if (!bestResolved) bestResolved = best;
                  const isNgState = NIGERIAN_STATES.some(
                    (s) => s.toLowerCase() === (best.state || '').toLowerCase()
                  );
                  const isNgAddress = isNigeriaText(best.address || '');
                  if (isNgState || isNgAddress) {
                    if (runId !== resolveRunIdRef.current) return;
                    applyResult(best);
                    return;
                  }
                }
              } catch {
                // Try next geocode variant
              }
            }
          }

          // Final fallback: still apply best resolved result so selection always populates.
          if (bestResolved && runId === resolveRunIdRef.current) {
            applyResult(bestResolved);
          }
        };

        run().finally(() => setLoading(false));
        return;
      }
      setLoading(true);
      fetch(
        '/api/places?placeId=' +
          encodeURIComponent(p.placeId) +
          '&sessionToken=' +
          encodeURIComponent(sessionTokenRef.current || nextSessionToken())
      )
        .then((res) => res.json())
        .then((data) => {
          if (runId !== resolveRunIdRef.current) return;
          if (data.address !== undefined) {
            applyResult(data as GeocodeResult);
            return;
          }
          fetch('/api/geocode?q=' + encodeURIComponent(p.label))
            .then((res) => res.json())
            .then((fallback) => {
              const results = fallback.results || [];
              if (results.length > 0) applyResult(results[0]);
            })
            .catch(() => {});
        })
        .catch(() => {
          fetch('/api/geocode?q=' + encodeURIComponent(p.label))
            .then((res) => res.json())
            .then((data) => {
              const results = data.results || [];
              if (results.length > 0) applyResult(results[0]);
            })
            .catch(() => {});
        })
        .finally(() => setLoading(false));
    },
    [applyResult, setValue]
  );

  /** Geocode current address string and move map marker (e.g. on blur when user typed but didn't select). */
  const geocodeAddressForMap = useCallback(
    (addressValue: string) => {
      if (mapUserPinned) return;
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
    [setValue, mapUserPinned]
  );

  const onAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (blurHideRef.current) {
      clearTimeout(blurHideRef.current);
      blurHideRef.current = undefined;
    }
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 280);
  };

  const onAddressBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    blurHideRef.current = setTimeout(() => {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }, 150);
    if (value.length >= 5) geocodeAddressForMap(value);
  };

  const onAddressFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (blurHideRef.current) {
      clearTimeout(blurHideRef.current);
      blurHideRef.current = undefined;
    }
    const value = e.target.value.trim();
    if (value.length >= 3) {
      fetchSuggestions(value);
    }
  };

  const onAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const activeItems =
      placeSuggestions.length > 0
        ? placeSuggestions.map((p) => ({ kind: 'place' as const, value: p }))
        : suggestions.map((s) => ({ kind: 'geocode' as const, value: s }));
    if (!activeItems.length || !showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % activeItems.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? activeItems.length - 1 : prev - 1));
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      return;
    }
    if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < activeItems.length) {
      e.preventDefault();
      const selected = activeItems[highlightedIndex];
      if (selected.kind === 'place') applyGooglePlacePrediction(selected.value);
      else applyResult(selected.value);
    }
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
              {...addressField}
              ref={(el) => {
                addressField.ref(el);
                addressInputRef.current = el;
              }}
              onChange={(e) => {
                addressField.onChange(e);
                onAddressChange(e);
              }}
              onFocus={onAddressFocus}
              onBlur={(e) => {
                addressField.onBlur(e);
                onAddressBlur(e);
              }}
              onKeyDown={onAddressKeyDown}
              type="text"
              placeholder="Search address like Google Maps"
              className="input"
              autoComplete="off"
            />
            {showSuggestions && (placeSuggestions.length > 0 || suggestions.length > 0) && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white py-1 shadow">
                {placeSuggestions.length > 0
                  ? placeSuggestions.map((p, idx) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm ${
                            highlightedIndex === idx ? 'bg-gray-100' : 'hover:bg-gray-100'
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            applyGooglePlacePrediction(p);
                            addressInputRef.current?.blur();
                          }}
                        >
                          <span className="block font-medium text-gray-900">{p.mainText || p.label}</span>
                          {p.secondaryText ? (
                            <span className="block text-xs text-gray-500">{p.secondaryText}</span>
                          ) : null}
                        </button>
                      </li>
                    ))
                  : suggestions.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm ${
                            highlightedIndex === i ? 'bg-gray-100' : 'hover:bg-gray-100'
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            applyResult(s);
                            addressInputRef.current?.blur();
                          }}
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
            Click the map to set the pin. After you place it, the pin stays put if you edit address, city, or suburb (until you refresh the page or pick a new place from search or GPS).
          </p>
          <MapPicker
            initialLat={coordinates?.lat}
            initialLng={coordinates?.lng}
            followFormCoordinates={!mapUserPinned}
            onPick={(lat, lng) => {
              setMapUserPinned(true);
              setValue('coordinates', { lat, lng }, { shouldValidate: true, shouldDirty: true });
              fetch('/api/geocode?lat=' + lat + '&lon=' + lng)
                .then((res) => res.json())
                .then((data) => {
                  if (data.address !== undefined) applyAddressFieldsOnly(data as GeocodeResult);
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
