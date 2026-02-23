import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

type User = { _id: string; name?: string; email?: string; role?: string };

const TOP_PADDING_EXTRA = 24;

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const topPad = (insets.top || 0) + TOP_PADDING_EXTRA;

  const load = () => {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    fetch(getApiUrl('admin/users'), { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token, user?.role]);

  const deleteUser = (userId: string, nameOrEmail: string, isSelf: boolean) => {
    if (isSelf) {
      Alert.alert('Not allowed', 'You cannot delete your own account.');
      return;
    }
    Alert.alert('Delete user', `Delete "${nameOrEmail}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          fetch(getApiUrl('admin/users/' + userId), {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token },
          })
            .then((r) => r.json())
            .then((d) => {
              if (d?.error) Alert.alert('Error', d.error);
              else load();
            })
            .catch(() => Alert.alert('Error', 'Failed to delete'));
        },
      },
    ]);
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.title}>Users</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#0d9488" style={styles.loader} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelf = item._id === user?.id;
            const nameOrEmail = item.name || item.email || '—';
            return (
              <View style={styles.card}>
                <View style={styles.cardMain}>
                  <Text style={styles.name}>{item.name || '—'}</Text>
                  <Text style={styles.email}>{item.email || '—'}</Text>
                  {item.role ? <View style={styles.roleBadge}><Text style={styles.roleText}>{item.role}</Text></View> : null}
                </View>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => router.push({ pathname: '/admin/users/[id]/edit', params: { id: item._id } })}>
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteUser(item._id, nameOrEmail, isSelf)}>
                    <Text style={[styles.actionText, styles.actionDanger]}>{isSelf ? 'Self' : 'Delete'}</Text>
                  </Pressable>
                </View>
              </View>
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
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cardMain: { flex: 1 },
  cardActions: { flexDirection: 'row', gap: 16 },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  email: { fontSize: 14, color: '#64748b', marginTop: 4 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: '#f0fdfa', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginTop: 8 },
  roleText: { fontSize: 12, fontWeight: '600', color: '#0d9488' },
  actionText: { fontSize: 14, color: '#0d9488', fontWeight: '600' },
  actionDanger: { color: '#dc2626' },
});
