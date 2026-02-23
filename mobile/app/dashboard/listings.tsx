import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

type Listing = {
  _id: string;
  title: string;
  price: number;
  status: string;
  listingType: string;
  rentPeriod?: string;
  location?: { city?: string; state?: string };
  images?: Array<{ url: string }>;
};

function formatPrice(n: number, rentPeriod?: string) {
  const fmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  return rentPeriod ? `${fmt}/${rentPeriod}` : fmt;
}

const TOP_PADDING_EXTRA = 24;

export default function MyListingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const topPad = (insets.top || 0) + TOP_PADDING_EXTRA;

  const load = () => {
    if (!token) return;
    setLoading(true);
    fetch(getApiUrl('listings', { mine: '1', limit: '50' }), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setListings(d.listings || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

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

  if (!token) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Sign in to view your listings.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <Pressable style={styles.addBtn} onPress={() => router.push('/listings/new')}>
          <Text style={styles.addBtnText}>+ Add listing</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#0c4a6e" style={styles.loader} />
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
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.images?.[0]?.url ? (
                <Image source={{ uri: item.images[0].url }} style={styles.cardImage} />
              ) : <View style={[styles.cardImage, styles.placeholder]} />}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardPrice}>{formatPrice(item.price, item.listingType === 'rent' ? item.rentPeriod : undefined)}</Text>
                <View style={styles.cardRow}>
                  <Text style={[styles.badge, item.status === 'active' ? styles.badgeActive : styles.badgeDraft]}>{item.status}</Text>
                  <View style={styles.actions}>
                    <Pressable onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item._id } })}><Text style={styles.actionText}>View</Text></Pressable>
                    <Pressable onPress={() => router.push({ pathname: '/listings/[id]/edit', params: { id: item._id } })}><Text style={styles.actionText}>Edit</Text></Pressable>
                    <Pressable onPress={() => deleteListing(item._id, item.title)}><Text style={[styles.actionText, styles.actionDanger]}>Delete</Text></Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 16, color: '#64748b' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backText: { fontSize: 16, color: '#0c4a6e', fontWeight: '500' },
  addBtn: { backgroundColor: '#0c4a6e', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  loader: { marginTop: 24 },
  list: { padding: 16, paddingBottom: 32 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#64748b', marginBottom: 12 },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  emptyBtnText: { color: '#0c4a6e', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  cardImage: { width: '100%', height: 140 },
  placeholder: { backgroundColor: '#e2e8f0' },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardPrice: { fontSize: 17, fontWeight: 'bold', color: '#0c4a6e', marginTop: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  badge: { fontSize: 12, fontWeight: '600', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  badgeActive: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeDraft: { backgroundColor: '#f1f5f9', color: '#475569' },
  actions: { flexDirection: 'row', gap: 16 },
  actionText: { fontSize: 14, color: '#0c4a6e', fontWeight: '500' },
  actionDanger: { color: '#dc2626' },
});
