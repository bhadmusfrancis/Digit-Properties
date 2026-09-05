import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl } from '../../../lib/api';
import { colors, radius } from '../../../lib/theme';

type MessageRow = {
  _id: string;
  body: string;
  createdAt?: string;
  sender: { _id: string; name: string } | null;
};

type ConversationRow = {
  _id: string;
  otherParty: { name?: string } | null;
  lastMessagePreview?: string;
  unreadCount?: number;
};

export default function ListingMessagesScreen() {
  const params = useLocalSearchParams<{ listingId: string }>();
  const listingId =
    typeof params.listingId === 'string' ? params.listingId : Array.isArray(params.listingId) ? params.listingId[0] : '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [role, setRole] = useState<'buyer' | 'owner' | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token || !listingId) return;
    return fetch(getApiUrl(`listings/${listingId}/messages`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.status === 401) {
          router.push('/auth/signin');
          return;
        }
        if (!r.ok) throw new Error(d.error || 'Failed to load');
        setRole(d.role === 'owner' ? 'owner' : 'buyer');
        setConversations(Array.isArray(d.conversations) ? d.conversations : []);
        setMessages(Array.isArray(d.messages) ? d.messages : []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, listingId, router]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const text = body.trim();
    if (!text || !token || sending) return;
    setSending(true);
    try {
      const r = await fetch(getApiUrl(`listings/${listingId}/messages`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Failed to send');
      setBody('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
    >
      <View style={[styles.head, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{role === 'owner' ? 'Listing messages' : 'Message lister'}</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : role === 'owner' ? (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>No one has messaged you about this listing yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/messages/${item._id}`)}>
              <Text style={styles.rowTitle}>{item.otherParty?.name || 'Buyer'}</Text>
              <Text style={styles.rowPreview} numberOfLines={1}>
                {item.lastMessagePreview || 'Open conversation'}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <>
          <FlatList
            data={messages}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={styles.empty}>Start a conversation about this listing.</Text>}
            renderItem={({ item }) => {
              const mine = item.sender?._id === user?.id;
              return (
                <View style={[styles.bubbleWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Text style={[styles.body, mine && { color: '#fff' }]}>{item.body}</Text>
                  </View>
                </View>
              );
            }}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={styles.input}
              value={body}
              onChangeText={(t) => setBody(t.slice(0, 2000))}
              placeholder="Ask a question about this property…"
              placeholderTextColor={colors.faint}
              multiline
            />
            <Pressable style={styles.send} onPress={() => void send()} disabled={!body.trim() || sending}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
  error: { color: colors.danger, paddingHorizontal: 16, marginBottom: 6 },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  rowPreview: { fontSize: 14, color: colors.body, marginTop: 4 },
  bubbleWrap: { marginBottom: 10 },
  bubble: { maxWidth: '86%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { backgroundColor: colors.primary },
  theirs: { backgroundColor: '#e2e8f0' },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
