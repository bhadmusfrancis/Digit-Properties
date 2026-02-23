import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';

export type MapPickResult = {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  suburb?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (result: MapPickResult) => void;
  onUseGpsFallback?: () => void;
  initialLat?: number;
  initialLng?: number;
};

type NativeModalComponent = React.ComponentType<{
  visible: boolean;
  onClose: () => void;
  onPick: (result: MapPickResult) => void;
  initialLat?: number;
  initialLng?: number;
}>;

export function MapPickerModal({
  visible,
  onClose,
  onPick,
  onUseGpsFallback,
  initialLat,
  initialLng,
}: Props) {
  const [NativeModal, setNativeModal] = useState<NativeModalComponent | 'unsupported' | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    import('./MapPickerModalNative')
      .then((m) => {
        if (!cancelled) setNativeModal(() => m.MapPickerModalNative);
      })
      .catch(() => {
        if (!cancelled) setNativeModal('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible) return null;

  if (NativeModal === null) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Pick on map</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0d9488" />
            <Text style={styles.loadingText}>Loading map…</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (NativeModal === 'unsupported') {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Pick on map</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.fallbackWrap}>
            <Text style={styles.fallbackTitle}>Map not available</Text>
            <Text style={styles.fallbackText}>
              The map picker needs a development build. In Expo Go, use GPS or type an address instead.
            </Text>
            {onUseGpsFallback && (
              <Pressable
                style={styles.gpsFallbackBtn}
                onPress={() => {
                  onClose();
                  onUseGpsFallback();
                }}
              >
                <Text style={styles.gpsFallbackBtnText}>Use GPS instead</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  const Native = NativeModal;
  return (
    <Native
      visible={visible}
      onClose={onClose}
      onPick={onPick}
      initialLat={initialLat}
      initialLng={initialLng}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cancelBtn: { padding: 8 },
  cancelText: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  placeholder: { width: 80 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#64748b' },
  fallbackWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  fallbackTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  fallbackText: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  gpsFallbackBtn: { marginTop: 24, backgroundColor: '#0d9488', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  gpsFallbackBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
