import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

type Claim = {
  _id: string;
  status: string;
  listingId?: { _id: string; title?: string } | string;
  userId?: { name?: string; email?: string } | string;
  createdAt?: string;
};

const TOP_PADDING_EXTRA = 24;

export default function AdminClaimsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const topPad = (insets.top || 0) + TOP_PADDING_EXTRA;

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    fetch(getApiUrl('claims'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setClaims(list.filter((c: Claim) => c.status === 'pending'));
      })
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  }, [token, user?.role]);

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.msg}>Admin only.</Text>
          <Pressable onPress={() => router.back()} style={styles.btn}><Text style={styles.btnText}>Back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const getListingTitle = (c: Claim) => {
    const L = c.listingId;
    if (L && typeof L === 'object' && 'title' in L) return (L as { title?: string }).title;
    return '—';
  };
  const getListingId = (c: Claim) => {
    const L = c.listingId;
    if (L && typeof L === 'object' && '_id' in L) return String((L as { _id: string })._id);
    return typeof L === 'string' ? L : '';
  };
  const getClaimant = (c: Claim) => {
    const U = c.userId;
    if (U && typeof U === 'object') return (U as { name?: string }).name || (U as { email?: string }).email || '—';
    return '—';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.title}>Pending Claims</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#0d9488" style={styles.loader} />
      ) : claims.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No pending claims.</Text>
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const listingId = getListingId(item);
            return (
              <Pressable
                style={styles.card}
                onPress={() => listingId && router.push({ pathname: '/listings/[id]', params: { id: listingId } })}
              >
                <Text style={styles.listingTitle} numberOfLines={2}>{getListingTitle(item)}</Text>
                <Text style={styles.claimant}>{getClaimant(item)}</Text>
                <Text style={styles.date}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-NG') : '—'}</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>Pending</Text></View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 16, color: '#64748b', marginBottom: 12 },
  btn: { padding: 12 }, btnText: { color: '#0d9488', fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backText: { fontSize: 16, color: '#0d9488', fontWeight: '500', marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  loader: { marginTop: 24 },
  list: { padding: 16, paddingBottom: 32 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#64748b' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  listingTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  claimant: { fontSize: 14, color: '#64748b', marginTop: 4 },
  date: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#fef3c7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginTop: 8 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#b45309' },
});
