import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { getApiUrl } from '../lib/api';

const DEFAULT_LAT = 6.5244;
const DEFAULT_LNG = 3.3792;
const DEFAULT_DELTA = 0.05;

export type MapPickResult = {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  suburb?: string;
};

export type MapPickerModalNativeProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (result: MapPickResult) => void;
  initialLat?: number;
  initialLng?: number;
};

export function MapPickerModalNative({ visible, onClose, onPick, initialLat, initialLng }: MapPickerModalNativeProps) {
  const [lat, setLat] = useState(initialLat ?? DEFAULT_LAT);
  const [lng, setLng] = useState(initialLng ?? DEFAULT_LNG);
  const [geocodeLoading, setGeocodeLoading] = useState(false);

  const handleMapPress = (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLat(latitude);
    setLng(longitude);
  };

  const handleUseLocation = async () => {
    setGeocodeLoading(true);
    try {
      const res = await fetch(getApiUrl('geocode', { lat: String(lat), lon: String(lng) }));
      const data = await res.json();
      if (data.address !== undefined) {
        onPick({
          lat: data.lat ?? lat,
          lng: data.lng ?? lng,
          address: data.address,
          city: data.city,
          state: data.state,
          suburb: data.suburb,
        });
        onClose();
      } else {
        onPick({ lat, lng });
        onClose();
      }
    } catch {
      onPick({ lat, lng });
      onClose();
    } finally {
      setGeocodeLoading(false);
    }
  };

  const region = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Pick on map</Text>
          <Pressable
            onPress={handleUseLocation}
            disabled={geocodeLoading}
            style={[styles.doneBtn, geocodeLoading && styles.doneBtnDisabled]}
          >
            {geocodeLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.doneText}>Use this location</Text>
            )}
          </Pressable>
        </View>
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            region={region}
            onPress={handleMapPress}
            mapType={Platform.OS === 'web' ? undefined : 'standard'}
          >
            <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor="#0d9488" />
          </MapView>
        </View>
        <Text style={styles.hint}>Tap on the map to set the property location.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cancelBtn: { padding: 8 },
  cancelText: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  doneBtn: { backgroundColor: '#0d9488', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  doneBtnDisabled: { opacity: 0.7 },
  doneText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  mapWrap: { flex: 1, minHeight: 300 },
  map: { width: '100%', height: '100%' },
  hint: { padding: 12, fontSize: 13, color: '#64748b', textAlign: 'center', backgroundColor: '#fff' },
});
