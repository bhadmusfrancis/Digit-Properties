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
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';
import { colors, radius } from '../../lib/theme';

type MessageRow = {
  _id: string;
  body: string;
  createdAt?: string;
  sender: { _id: string; name: string } | null;
};

export default function MessageThreadScreen() {
  const params = useLocalSearchParams<{ conversationId: string }>();
  const conversationId =
    typeof params.conversationId === 'string'
      ? params.conversationId
      : Array.isArray(params.conversationId)
        ? params.conversationId[0]
        : '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [title, setTitle] = useState('Conversation');
  const [other, setOther] = useState('User');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token || !conversationId) return;
    return fetch(getApiUrl(`messages/${conversationId}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Failed to load');
        setTitle(d.conversation?.listing?.title || 'Conversation');
        setOther(d.conversation?.otherParty?.name || 'User');
        setMessages(Array.isArray(d.messages) ? d.messages : []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, conversationId]);

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
      const r = await fetch(getApiUrl(`messages/${conversationId}`), {
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            With {other}
          </Text>
        </View>
      </View>
      {loading && messages.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          renderItem={({ item }) => {
            const mine = item.sender?._id === user?.id;
            return (
              <View style={[styles.bubbleWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  {!mine ? <Text style={styles.sender}>{item.sender?.name || 'User'}</Text> : null}
                  <Text style={[styles.body, mine && { color: '#fff' }]}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={(t) => setBody(t.slice(0, 2000))}
          placeholder="Write a reply…"
          placeholderTextColor={colors.faint}
          multiline
        />
        <Pressable style={styles.send} onPress={() => void send()} disabled={!body.trim() || sending}>
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  bubbleWrap: { marginBottom: 10 },
  bubble: { maxWidth: '86%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { backgroundColor: colors.primary },
  theirs: { backgroundColor: '#e2e8f0' },
  sender: { fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 2 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  error: { color: colors.danger, paddingHorizontal: 16, marginBottom: 6 },
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
