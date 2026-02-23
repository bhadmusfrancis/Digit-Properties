import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl } from '../../../lib/api';

type AdminStats = { usersCount: number; listingsCount: number; pendingClaims: number } | null;

const TEAL = '#0d9488';
const CARD_RADIUS = 16;
const SLATE_600 = '#475569';
const SLATE_400 = '#94a3b8';

export default function AdminTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token } = useAuth();
  const [adminStats, setAdminStats] = useState<AdminStats>(null);
  const [loading, setLoading] = useState(true);
  const topPad = (insets.top || 0) + 20;

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    fetch(getApiUrl('admin/stats'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) return null;
        return {
          usersCount: Number(d?.usersCount ?? 0),
          listingsCount: Number(d?.listingsCount ?? 0),
          pendingClaims: Number(d?.pendingClaims ?? 0),
        };
      })
      .then(setAdminStats)
      .catch(() => setAdminStats(null))
      .finally(() => setLoading(false));
  }, [token, user?.role]);

  if (user?.role !== 'admin') {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <Text style={styles.msg}>Admin only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingTop: topPad }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Admin</Text>
      <Text style={styles.subtitle}>Manage users, listings, and claims</Text>

      {loading ? (
        <ActivityIndicator size="large" color={TEAL} style={styles.loader} />
      ) : (
        <>
          <View style={styles.cardRow}>
            <Pressable style={styles.statCard} onPress={() => router.push('/admin/users')}>
              <Text style={styles.statValue}>{adminStats?.usersCount ?? 0}</Text>
              <Text style={styles.statLabel}>Users</Text>
              <Text style={styles.statLink}>Manage →</Text>
            </Pressable>
            <Pressable style={styles.statCard} onPress={() => router.push('/admin/listings')}>
              <Text style={styles.statValue}>{adminStats?.listingsCount ?? 0}</Text>
              <Text style={styles.statLabel}>Listings</Text>
              <Text style={styles.statLink}>Manage →</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.statCard, styles.statCardFull]} onPress={() => router.push('/admin/claims')}>
            <Text style={[styles.statValue, styles.amberText]}>{adminStats?.pendingClaims ?? 0}</Text>
            <Text style={styles.statLabel}>Pending Claims</Text>
            <Text style={styles.statLink}>Review →</Text>
          </Pressable>
        </>
      )}
      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 16, color: SLATE_600 },
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingTop: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 15, color: SLATE_600, marginBottom: 24 },
  loader: { marginVertical: 24 },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statCardFull: { marginBottom: 0 },
  statValue: { fontSize: 26, fontWeight: '700', color: TEAL },
  amberText: { color: '#d97706' },
  statLabel: { fontSize: 14, color: SLATE_600, marginTop: 4 },
  statLink: { fontSize: 13, color: TEAL, fontWeight: '600', marginTop: 8 },
  bottomPad: { height: 40 },
});
