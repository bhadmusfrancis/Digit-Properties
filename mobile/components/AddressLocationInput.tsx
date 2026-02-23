import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import * as Location from 'expo-location';
import { getApiUrl } from '../lib/api';
import { NIGERIAN_STATES } from '../lib/constants';
import { MapPickerModal } from './MapPickerModal';

export type GeocodeResult = {
  address: string;
  city: string;
  state: string;
  suburb: string;
  lat: number;
  lng: number;
};

type Props = {
  address: string;
  city: string;
  state: string;
  suburb: string;
  onAddressChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onSuburbChange: (v: string) => void;
  onCoordinates?: (lat: number, lng: number) => void;
  editable?: boolean;
};

const DEBOUNCE_MS = 350;

export function AddressLocationInput({
  address,
  city,
  state,
  suburb,
  onAddressChange,
  onCityChange,
  onStateChange,
  onSuburbChange,
  onCoordinates,
  editable = true,
}: Props) {
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyResult = useCallback(
    (r: GeocodeResult) => {
      onAddressChange(r.address || '');
      onCityChange(r.city || '');
      let stateVal = (r.state || '').trim();
      if (stateVal.toLowerCase() === 'federal capital territory') stateVal = 'FCT';
      const stateMatch = NIGERIAN_STATES.find((s) => s.toLowerCase() === stateVal.toLowerCase());
      onStateChange(stateMatch || NIGERIAN_STATES[0]);
      onSuburbChange(r.suburb || '');
      onCoordinates?.(r.lat, r.lng);
      setLastCoords({ lat: r.lat, lng: r.lng });
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [onAddressChange, onCityChange, onStateChange, onSuburbChange, onCoordinates]
  );

  const handleMapPick = useCallback(
    (result: { lat: number; lng: number; address?: string; city?: string; state?: string; suburb?: string }) => {
      if (result.address !== undefined && result.city !== undefined) {
        let stateVal = (result.state || '').trim();
        if (stateVal.toLowerCase() === 'federal capital territory') stateVal = 'FCT';
        const stateMatch = NIGERIAN_STATES.find((s) => s.toLowerCase() === stateVal.toLowerCase());
        applyResult({
          address: result.address,
          city: result.city,
          state: result.state || '',
          suburb: result.suburb || '',
          lat: result.lat,
          lng: result.lng,
        });
      } else {
        onCoordinates?.(result.lat, result.lng);
        setLastCoords({ lat: result.lat, lng: result.lng });
        onAddressChange('');
        onCityChange('');
        onStateChange(NIGERIAN_STATES[0]);
        onSuburbChange('');
      }
      setMapVisible(false);
    },
    [applyResult, onAddressChange, onCityChange, onStateChange, onSuburbChange, onCoordinates]
  );

  const fetchSuggestions = useCallback((query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    fetch(getApiUrl('geocode', { q: query }))
      .then((res) => res.json())
      .then((data) => {
        setSuggestions(data.results || []);
        setShowSuggestions(true);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  const onAddressTextChange = (text: string) => {
    onAddressChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), DEBOUNCE_MS);
  };

  const useGps = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to use GPS.');
        return;
      }
      setGpsLoading(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const res = await fetch(getApiUrl('geocode', { lat: String(latitude), lon: String(longitude) }));
      const data = await res.json();
      if (data.address !== undefined) {
        applyResult({
          address: data.address,
          city: data.city || '',
          state: data.state || '',
          suburb: data.suburb || '',
          lat: data.lat ?? latitude,
          lng: data.lng ?? longitude,
        });
      } else {
        Alert.alert('Address not found', 'Could not resolve address for this location.');
      }
    } catch {
      Alert.alert('Error', 'Could not get your location. Check permissions.');
    } finally {
      setGpsLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Address *</Text>
      <View style={styles.addressRow}>
        <TextInput
          style={[styles.input, styles.addressInput]}
          value={address}
          onChangeText={onAddressTextChange}
          placeholder="Type address or use GPS / Map"
          placeholderTextColor="#94a3b8"
          editable={editable}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.gpsBtn, gpsLoading && styles.gpsBtnDisabled]}
          onPress={useGps}
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color="#0d9488" />
          ) : (
            <Text style={styles.gpsBtnText}>GPS</Text>
          )}
        </Pressable>
        <Pressable style={styles.mapBtn} onPress={() => setMapVisible(true)} disabled={!editable}>
          <Text style={styles.mapBtnText}>Map</Text>
        </Pressable>
      </View>
      <MapPickerModal
        visible={mapVisible}
        onClose={() => setMapVisible(false)}
        onPick={handleMapPick}
        onUseGpsFallback={() => {
          setMapVisible(false);
          useGps();
        }}
        initialLat={lastCoords?.lat}
        initialLng={lastCoords?.lng}
      />
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.suggestionsScroll} nestedScrollEnabled>
            {suggestions.map((s, i) => (
              <Pressable key={i} style={styles.suggestionItem} onPress={() => applyResult(s)}>
                <Text style={styles.suggestionText} numberOfLines={2}>{s.address}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#0d9488" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}
      <View style={styles.row2}>
        <View style={styles.half}>
          <Text style={styles.label}>City *</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={onCityChange}
            placeholder="e.g. Lagos"
            placeholderTextColor="#94a3b8"
            editable={editable}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>State *</Text>
          <TextInput
            style={styles.input}
            value={state}
            onChangeText={onStateChange}
            placeholder="e.g. Lagos"
            placeholderTextColor="#94a3b8"
            editable={editable}
          />
        </View>
      </View>
      <Text style={styles.label}>Suburb / Area (optional)</Text>
      <TextInput
        style={styles.input}
        value={suburb}
        onChangeText={onSuburbChange}
        placeholder="e.g. Lekki Phase 1"
        placeholderTextColor="#94a3b8"
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addressInput: { flex: 1 },
  gpsBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  gpsBtnDisabled: { opacity: 0.7 },
  gpsBtnText: { fontSize: 14, fontWeight: '600', color: '#0d9488' },
  mapBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  mapBtnText: { fontSize: 14, fontWeight: '600', color: '#0d9488' },
  suggestions: { maxHeight: 160, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', marginTop: 4 },
  suggestionsScroll: { maxHeight: 160 },
  suggestionItem: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  suggestionText: { fontSize: 14, color: '#334155' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  loadingText: { fontSize: 12, color: '#64748b' },
  row2: { flexDirection: 'row', gap: 12, marginTop: 12 },
  half: { flex: 1 },
});
