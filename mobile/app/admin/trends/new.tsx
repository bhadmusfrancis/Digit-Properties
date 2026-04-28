import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl } from '../../../lib/api';

const CATEGORIES = ['news', 'insight', 'journal'] as const;
const STATUSES = ['draft', 'published'] as const;
const TOP_PADDING_EXTRA = 24;

export default function AdminTrendNewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('news');
  const [author, setAuthor] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('draft');
  const [saving, setSaving] = useState(false);
  const topPad = (insets.top || 0) + TOP_PADDING_EXTRA;

  const contentLooksEmpty = useMemo(
    () => content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length === 0,
    [content]
  );

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.msg}>Admin only.</Text>
          <Pressable onPress={() => router.back()} style={styles.btn}>
            <Text style={styles.btnText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  async function savePost() {
    if (!token) {
      Alert.alert('Error', 'You are not signed in.');
      return;
    }
    if (title.trim().length < 3) {
      Alert.alert('Missing title', 'Title must be at least 3 characters.');
      return;
    }
    if (contentLooksEmpty) {
      Alert.alert('Missing content', 'Content is required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(getApiUrl('admin/trends'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim() || undefined,
          excerpt: excerpt.trim(),
          content: content.trim(),
          category,
          imageUrl: imageUrl.trim() || undefined,
          author: author.trim() || undefined,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Failed to create', data?.error || 'Please try again.');
        return;
      }
      Alert.alert('Created', 'Blog post created successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Request failed', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>New Blog Post</Text>
      </View>
      <ScrollView contentContainerStyle={styles.form}>
        <Field label="Title *">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Lagos Property Market Q4 Outlook"
            style={styles.input}
            editable={!saving}
          />
        </Field>

        <Field label="Slug (optional)">
          <TextInput
            value={slug}
            onChangeText={setSlug}
            placeholder="auto-from-title-if-empty"
            style={styles.input}
            editable={!saving}
            autoCapitalize="none"
          />
        </Field>

        <Field label="Category">
          <View style={styles.segmentRow}>
            {CATEGORIES.map((item) => (
              <Pressable
                key={item}
                style={[styles.segment, category === item && styles.segmentActive]}
                onPress={() => setCategory(item)}
                disabled={saving}
              >
                <Text style={[styles.segmentText, category === item && styles.segmentTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Excerpt">
          <TextInput
            value={excerpt}
            onChangeText={setExcerpt}
            placeholder="Short summary for cards and SEO"
            style={[styles.input, styles.multiline]}
            editable={!saving}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Field>

        <Field label="Content *">
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Write post content here (plain text or HTML)"
            style={[styles.input, styles.contentInput]}
            editable={!saving}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />
          {contentLooksEmpty ? <Text style={styles.errorText}>Content is required.</Text> : null}
        </Field>

        <Field label="Author">
          <TextInput value={author} onChangeText={setAuthor} style={styles.input} editable={!saving} />
        </Field>

        <Field label="Image URL">
          <TextInput
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://..."
            style={styles.input}
            editable={!saving}
            autoCapitalize="none"
          />
        </Field>

        <Field label="Status">
          <View style={styles.segmentRow}>
            {STATUSES.map((item) => (
              <Pressable
                key={item}
                style={[styles.segment, status === item && styles.segmentActive]}
                onPress={() => setStatus(item)}
                disabled={saving}
              >
                <Text style={[styles.segmentText, status === item && styles.segmentTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Pressable style={[styles.submitBtn, saving && styles.submitBtnDisabled]} onPress={savePost} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Post</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 16, color: '#64748b', marginBottom: 12 },
  btn: { padding: 12 },
  btnText: { color: '#0d9488', fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backText: { fontSize: 16, color: '#0d9488', fontWeight: '500', marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  form: { padding: 16, paddingBottom: 36 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  multiline: { minHeight: 82 },
  contentInput: { minHeight: 180 },
  errorText: { marginTop: 6, fontSize: 12, color: '#dc2626' },
  segmentRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  segment: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  segmentActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  segmentText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  submitBtn: {
    marginTop: 10,
    backgroundColor: '#0d9488',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
