import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl } from '../../../lib/api';

type Stats = { listingsCount: number; claimsCount: number } | null;
type AdminStats = { usersCount: number; listingsCount: number; pendingClaims: number } | null;

const TEAL = '#0d9488';
const SLATE_900 = '#0f172a';
const SLATE_600 = '#475569';
const SLATE_400 = '#94a3b8';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token, signOut } = useAuth();
  const [stats, setStats] = useState<Stats>(null);
  const [adminStats, setAdminStats] = useState<AdminStats>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin';

  const fetchStats = useCallback(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(getApiUrl('dashboard/stats'), { headers: { Authorization: 'Bearer ' + token } })
        .then((r) => r.json())
        .then((d) => {
          if (d?.error) return null;
          return { listingsCount: Number(d?.listingsCount ?? 0), claimsCount: Number(d?.claimsCount ?? 0) };
        }),
      isAdmin
        ? fetch(getApiUrl('admin/stats'), { headers: { Authorization: 'Bearer ' + token } })
            .then((r) => r.json())
            .then((d) => {
              if (d?.error) return null;
              return {
                usersCount: Number(d?.usersCount ?? 0),
                listingsCount: Number(d?.listingsCount ?? 0),
                pendingClaims: Number(d?.pendingClaims ?? 0),
              };
            })
        : Promise.resolve(null),
    ])
      .then(([dashboardRes, adminRes]) => {
        setStats(dashboardRes);
        setAdminStats(adminRes);
      })
      .catch(() => {
        setStats(null);
        setAdminStats(null);
      })
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  const topPad = (insets.top || 0) + 20;

  if (!user) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <Text style={styles.msg}>Sign in to view your dashboard.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/auth/signin')}>
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingTop: topPad }]} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.userName}>{user.name || user.email}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={TEAL} style={styles.loader} />
      ) : (
        <>
          {isAdmin && adminStats !== null && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Admin</Text>
              <View style={styles.cardRow}>
                <Pressable style={styles.statCard} onPress={() => router.push('/admin/users')}>
                  <Text style={styles.statValue}>{adminStats.usersCount}</Text>
                  <Text style={styles.statLabel}>Users</Text>
                  <Text style={styles.statLink}>Manage</Text>
                </Pressable>
                <Pressable style={styles.statCard} onPress={() => router.push('/admin/listings')}>
                  <Text style={styles.statValue}>{adminStats.listingsCount}</Text>
                  <Text style={styles.statLabel}>Listings</Text>
                  <Text style={styles.statLink}>Manage</Text>
                </Pressable>
              </View>
              <Pressable style={[styles.statCard, styles.statCardFull]} onPress={() => router.push('/admin/claims')}>
                <Text style={[styles.statValue, styles.amberText]}>{adminStats.pendingClaims}</Text>
                <Text style={styles.statLabel}>Pending Claims</Text>
                <Text style={styles.statLink}>Review</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My account</Text>
            <Pressable style={styles.menuCard} onPress={() => router.push('/dashboard/listings')}>
              <View style={styles.menuCardLeft}>
                <Text style={styles.menuTitle}>My Listings</Text>
                <Text style={styles.menuSub}>View and manage your listings</Text>
              </View>
              <View style={styles.menuCardRight}>
                <Text style={styles.menuCount}>{stats?.listingsCount ?? 0}</Text>
                <Text style={styles.menuArrow}>→</Text>
              </View>
            </Pressable>
            <Pressable style={styles.menuCard} onPress={() => router.push('/dashboard/claims')}>
              <View style={styles.menuCardLeft}>
                <Text style={styles.menuTitle}>Pending Claims</Text>
                <Text style={styles.menuSub}>Track your property claims</Text>
              </View>
              <View style={styles.menuCardRight}>
                <Text style={styles.menuCount}>{stats?.claimsCount ?? 0}</Text>
                <Text style={styles.menuArrow}>→</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.menuCard, styles.menuCardPrimary]} onPress={() => router.push('/listings/new')}>
              <View style={styles.menuCardLeft}>
                <Text style={[styles.menuTitle, styles.menuTitleWhite]}>List a property</Text>
                <Text style={styles.menuSubWhite}>Create a new listing</Text>
              </View>
              <Text style={styles.menuArrowWhite}>+ Add</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Pressable style={styles.linkRow} onPress={() => router.push('/listings')}>
              <Text style={styles.linkText}>Browse all listings</Text>
              <Text style={styles.linkArrow}>→</Text>
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => router.push('/')}>
              <Text style={styles.linkText}>Home</Text>
              <Text style={styles.linkArrow}>→</Text>
            </Pressable>
          </View>

          <Pressable style={styles.signOutBtn} onPress={() => signOut()}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
          <View style={styles.bottomPad} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 16, color: SLATE_600, textAlign: 'center', marginBottom: 16 },
  primaryBtn: { backgroundColor: TEAL, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingTop: 24 },
  loader: { marginVertical: 24 },
  heroCard: { backgroundColor: TEAL, padding: 24, borderRadius: 16, marginBottom: 24 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 4 },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: SLATE_400, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  statCardFull: { marginBottom: 0 },
  statValue: { fontSize: 26, fontWeight: '700', color: TEAL },
  amberText: { color: '#d97706' },
  statLabel: { fontSize: 14, color: SLATE_600, marginTop: 4 },
  statLink: { fontSize: 13, color: TEAL, fontWeight: '600', marginTop: 8 },
  menuCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  menuCardPrimary: { backgroundColor: TEAL, borderColor: TEAL },
  menuCardLeft: { flex: 1 },
  menuCardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuTitle: { fontSize: 17, fontWeight: '600', color: SLATE_900 },
  menuTitleWhite: { color: '#fff' },
  menuSub: { fontSize: 14, color: SLATE_600, marginTop: 2 },
  menuSubWhite: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  menuCount: { fontSize: 22, fontWeight: '700', color: TEAL },
  menuArrow: { fontSize: 18, color: SLATE_400 },
  menuArrowWhite: { fontSize: 16, fontWeight: '600', color: '#fff' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  linkText: { fontSize: 16, fontWeight: '500', color: SLATE_900 },
  linkArrow: { fontSize: 16, color: SLATE_400 },
  signOutBtn: { marginTop: 24, padding: 16, alignItems: 'center' },
  signOutText: { fontSize: 16, color: '#dc2626', fontWeight: '500' },
  bottomPad: { height: 40 },
});
