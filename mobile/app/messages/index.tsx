import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';
import { colors, radius } from '../../lib/theme';

type ConversationRow = {
  _id: string;
  yourRole: string;
  listing: { title?: string } | null;
  otherParty: { name?: string } | null;
  lastMessagePreview?: string;
  unreadCount?: number;
};

export default function MessagesInboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    return fetch(getApiUrl('messages'), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Failed to load messages');
        setRows(Array.isArray(d.conversations) ? d.conversations : []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  if (!token) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.error}>Sign in to view messages.</Text>
        <Pressable onPress={() => router.push('/auth/signin')}>
          <Text style={styles.link}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Messages</Text>
      </View>
      {loading && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/messages/${item._id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.listing?.title || 'Listing'}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.yourRole === 'owner' ? 'From' : 'To'} {item.otherParty?.name || 'User'}
                </Text>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {item.lastMessagePreview || 'Open conversation'}
                </Text>
              </View>
              {(item.unreadCount ?? 0) > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24, paddingHorizontal: 20 },
  link: { color: colors.primary, fontWeight: '700', marginTop: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 32 },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  rowMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rowPreview: { fontSize: 14, color: colors.body, marginTop: 4 },
  badge: { backgroundColor: colors.primary, borderRadius: 12, minWidth: 24, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
});
