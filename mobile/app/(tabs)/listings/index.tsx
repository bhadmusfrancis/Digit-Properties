import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, ActivityIndicator, Alert, Switch } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl } from '../../../lib/api';
import { AppHeader } from '../../../components/AppHeader';

type Listing = {
  _id: string;
  title: string;
  price: number;
  status: string;
  listingType: string;
  rentPeriod?: string;
  soldAt?: string | null;
  rentedAt?: string | null;
  location?: { city?: string; state?: string };
  images?: Array<{ url: string }>;
};

function formatPrice(n: number, rentPeriod?: string) {
  const fmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  return rentPeriod ? `${fmt}/${rentPeriod}` : fmt;
}

export default function MyListingsTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch(getApiUrl('listings', { mine: '1', limit: '50' }), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setListings(d.listings || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const updateSoldRented = (id: string, soldAt: boolean, rentedAt: boolean) => {
    if (!token) return;
    setTogglingId(id);
    fetch(getApiUrl('listings/' + id + '/status'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ soldAt: soldAt || undefined, rentedAt: rentedAt || undefined }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((updated) => {
        if (updated) {
          setListings((prev) =>
            prev.map((l) =>
              l._id === id
                ? { ...l, soldAt: updated.soldAt, rentedAt: updated.rentedAt }
                : l
            )
          );
        }
      })
      .finally(() => setTogglingId(null));
  };

  const deleteListing = (id: string, title: string) => {
    Alert.alert('Delete listing', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          fetch(getApiUrl('listings/' + id), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => { if (r.ok) load(); })
            .catch(() => {});
        },
      },
    ]);
  };

  const topPad = (insets.top || 0) + 8;

  if (!token) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <AppHeader />
        <Text style={styles.msg}>Sign in to view your listings.</Text>
        <Pressable style={styles.signInBtn} onPress={() => router.replace('/auth/signin')}>
          <Text style={styles.signInBtnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: topPad }]}>
        <AppHeader />
        <Pressable style={styles.addBtn} onPress={() => router.push('/listings/new')}>
          <Text style={styles.addBtnText}>+ Add listing</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#0d9488" style={styles.loader} />
      ) : listings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No listings yet.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/listings/new')}>
            <Text style={styles.emptyBtnText}>Create one</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSold = !!item.soldAt;
            const isRented = !!item.rentedAt;
            const isSale = item.listingType === 'sale';
            const isRent = item.listingType === 'rent';
            const busy = togglingId === item._id;
            return (
              <View style={styles.card}>
                {item.images?.[0]?.url ? (
                  <Image source={{ uri: item.images[0].url }} style={styles.cardImage} />
                ) : <View style={[styles.cardImage, styles.placeholder]} />}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardPrice}>{formatPrice(item.price, isRent ? item.rentPeriod : undefined)}</Text>
                  <View style={styles.badgeRow}>
                    <Text style={[styles.badge, item.status === 'active' ? styles.badgeActive : item.status === 'pending_approval' ? styles.badgePending : styles.badgeDraft]}>
                      {item.status === 'pending_approval' ? 'Pending approval' : item.status}
                    </Text>
                  </View>
                  {(isSale || isRent) && (
                    <View style={styles.toggleRow}>
                      {isSale && (
                        <View style={styles.toggleWrap}>
                          <Text style={styles.toggleLabel}>Sold</Text>
                          <Switch
                            value={isSold}
                            onValueChange={(v) => updateSoldRented(item._id, v, false)}
                            disabled={busy}
                            trackColor={{ false: '#e2e8f0', true: '#0d9488' }}
                            thumbColor="#fff"
                          />
                        </View>
                      )}
                      {isRent && (
                        <View style={styles.toggleWrap}>
                          <Text style={styles.toggleLabel}>Rented</Text>
                          <Switch
                            value={isRented}
                            onValueChange={(v) => updateSoldRented(item._id, false, v)}
                            disabled={busy}
                            trackColor={{ false: '#e2e8f0', true: '#0d9488' }}
                            thumbColor="#fff"
                          />
                        </View>
                      )}
                    </View>
                  )}
                  <View style={styles.actions}>
                    <Pressable onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item._id } })}>
                      <Text style={styles.actionText}>View</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push({ pathname: '/listings/[id]/edit', params: { id: item._id } })}>
                      <Text style={styles.actionText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => deleteListing(item._id, item.title)}>
                      <Text style={[styles.actionText, styles.actionDanger]}>Delete</Text>
                    </Pressable>
                  </View>
                  {item.status === 'pending_approval' && (
                    <Text style={styles.pendingNote}>Modified listing is pending approval.</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#f8fafc' },
  msg: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 24 },
  signInBtn: { backgroundColor: '#0d9488', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 16 },
  signInBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  addBtn: { backgroundColor: '#0d9488', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  loader: { marginTop: 24 },
  list: { padding: 16, paddingBottom: 32 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#64748b', marginBottom: 12 },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  emptyBtnText: { color: '#0d9488', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  cardImage: { width: '100%', height: 140 },
  placeholder: { backgroundColor: '#e2e8f0' },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardPrice: { fontSize: 17, fontWeight: 'bold', color: '#0d9488', marginTop: 4 },
  badgeRow: { marginTop: 8 },
  badge: { fontSize: 12, fontWeight: '600', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  badgeActive: { backgroundColor: '#ccfbf1', color: '#0f766e' },
  badgeDraft: { backgroundColor: '#f1f5f9', color: '#475569' },
  badgePending: { backgroundColor: '#fef3c7', color: '#b45309' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 20 },
  toggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 12 },
  actionText: { fontSize: 14, color: '#0d9488', fontWeight: '500' },
  actionDanger: { color: '#dc2626' },
  pendingNote: { fontSize: 12, color: '#b45309', marginTop: 8 },
});
