import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../lib/api';

type Stats = { listingsCount: number; claimsCount: number } | null;

export default function DashboardScreen() {
  const router = useRouter();
  const { user, token, signOut } = useAuth();
  const [stats, setStats] = useState<Stats>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(getApiUrl('dashboard/stats'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setStats(d.error ? null : d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Sign in to view your dashboard.</Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/auth/signin')}>
          <Text style={styles.btnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.greeting}>Welcome back, {user.name || user.email}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0c4a6e" style={styles.loader} />
      ) : (
        <>
          <Pressable style={styles.menuCard} onPress={() => router.push('/dashboard/listings')}>
            <Text style={styles.menuTitle}>My Listings</Text>
            <Text style={styles.menuCount}>{stats?.listingsCount ?? 0}</Text>
            <Text style={styles.menuSub}>View and manage your listings</Text>
          </Pressable>
          <Pressable style={styles.menuCard} onPress={() => router.push('/dashboard/claims')}>
            <Text style={styles.menuTitle}>Pending Claims</Text>
            <Text style={styles.menuCount}>{stats?.claimsCount ?? 0}</Text>
            <Text style={styles.menuSub}>Track your property claims</Text>
          </Pressable>
          <Pressable style={styles.menuCard} onPress={() => router.push('/listings/new')}>
            <Text style={styles.menuTitle}>List a property</Text>
            <Text style={styles.menuSub}>Create a new listing</Text>
            <Text style={styles.menuLink}>+ Add listing →</Text>
          </Pressable>
        </>
      )}

      <Pressable style={styles.menuItem} onPress={() => router.push('/listings')}>
        <Text style={styles.menuItemText}>Browse all listings</Text>
        <Text style={styles.menuItemArrow}>→</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => router.push('/')}>
        <Text style={styles.menuItemText}>Home</Text>
        <Text style={styles.menuItemArrow}>→</Text>
      </Pressable>
      <Pressable style={styles.signOutBtn} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#0c4a6e', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingTop: 24 },
  loader: { marginVertical: 24 },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  email: { fontSize: 14, color: '#64748b', marginTop: 4 },
  menuCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  menuCount: { fontSize: 28, fontWeight: 'bold', color: '#0c4a6e', marginTop: 4 },
  menuSub: { fontSize: 14, color: '#64748b', marginTop: 2 },
  menuLink: { fontSize: 15, color: '#0c4a6e', fontWeight: '600', marginTop: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItemText: { fontSize: 16, fontWeight: '500', color: '#0f172a' },
  menuItemArrow: { fontSize: 16, color: '#94a3b8' },
  signOutBtn: { marginTop: 24, padding: 16, alignItems: 'center' },
  signOutText: { fontSize: 16, color: '#dc2626', fontWeight: '500' },
  bottomPad: { height: 40 },
});
