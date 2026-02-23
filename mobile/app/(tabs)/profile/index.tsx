import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';

const TEAL = '#0d9488';
const SLATE_600 = '#475569';
const SLATE_900 = '#0f172a';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoaded, signOut } = useAuth();
  const topPad = (insets.top || 0) + 20;

  if (!isLoaded) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <Text style={styles.msg}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <Text style={styles.msg}>Sign in to view your profile.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/auth/signin')}>
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingTop: topPad }]} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user.name || '-'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user.email}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{user.role || 'user'}</Text>
      </View>

      <Pressable style={styles.primaryBtn} onPress={() => router.push('/listings/new')}>
        <Text style={styles.primaryBtnText}>Create a listing</Text>
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
  msg: { fontSize: 16, color: SLATE_600, textAlign: 'center', marginBottom: 16 },
  primaryBtn: { backgroundColor: TEAL, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, alignSelf: 'stretch', alignItems: 'center', marginTop: 24 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingTop: 24 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 12, color: SLATE_600, textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 17, fontWeight: '600', color: SLATE_900 },
  signOutBtn: { marginTop: 24, padding: 16, alignItems: 'center' },
  signOutText: { fontSize: 16, color: '#dc2626', fontWeight: '500' },
  bottomPad: { height: 40 },
});
