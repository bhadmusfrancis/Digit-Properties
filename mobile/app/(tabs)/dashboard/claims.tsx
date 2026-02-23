import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl } from '../../../lib/api';

type Claim = {
  _id: string;
  status: string;
  listingId?: { title?: string };
  createdAt?: string;
};

export default function MyClaimsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const topPad = (insets.top || 0) + 20;

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(getApiUrl('claims'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setClaims(Array.isArray(d) ? d : []))
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <Text style={styles.msg}>Sign in to view your claims.</Text>
      </View>
    );
  }

  const pending = claims.filter((c) => c.status === 'pending');

  return (
    <View style={styles.container}>
      <Pressable style={[styles.header, { paddingTop: topPad }]} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      {loading ? (
        <ActivityIndicator size="large" color="#0c4a6e" style={styles.loader} />
      ) : pending.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No pending claims.</Text>
          <Text style={styles.emptySub}>Claims you submit for listings will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const listing = item.listingId as { title?: string } | undefined;
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle} numberOfLines={2}>{listing?.title || 'Listing'}</Text>
                <Text style={styles.badge}>Pending</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 16, color: '#64748b' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backText: { fontSize: 16, color: '#0c4a6e', fontWeight: '500' },
  loader: { marginTop: 24 },
  list: { padding: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#0f172a', fontWeight: '500' },
  emptySub: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  badge: { fontSize: 12, color: '#b45309', fontWeight: '600', marginTop: 6 },
});
