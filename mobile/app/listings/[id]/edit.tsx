import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl } from '../../../lib/api';

const TEAL = '#0d9488';

export default function EditListingScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !token) return;
    fetch(getApiUrl('listings/' + id), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setTitle(data.title || '');
          setDescription(data.description || '');
          setPrice(String(data.price ?? ''));
        }
      })
      .catch(() => setError('Failed to load listing'))
      .finally(() => setLoading(false));
  }, [id, token]);

  const handleSave = () => {
    const numPrice = parseInt(price, 10);
    if (!id || !token || !title.trim() || description.trim().length < 20 || Number.isNaN(numPrice) || numPrice < 0) {
      setError('Title (min 5 chars), description (min 20 chars), and a valid price are required.');
      return;
    }
    setError('');
    setSaving(true);
    fetch(getApiUrl('listings/' + id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        price: numPrice,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
          return;
        }
        const status = data?.status;
        if (status === 'pending_approval') {
          Alert.alert(
            'Submitted for approval',
            'Your changes have been saved. This listing will be visible again after admin approval.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } else {
          Alert.alert('Saved', 'Your listing has been updated.', [{ text: 'OK', onPress: () => router.back() }]);
        }
      })
      .catch(() => setError('Failed to save'))
      .finally(() => setSaving(false));
  };

  const topPad = (insets.top || 0) + 12;

  if (!id) {
    router.back();
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingTop: topPad }]}>
      <Pressable onPress={() => router.back()} style={styles.backWrap}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Edit listing</Text>
      <Text style={styles.hint}>Modified listings are submitted for approval before going live again.</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Listing title (min 5 characters)"
        placeholderTextColor="#94a3b8"
      />
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Description (min 20 characters)"
        placeholderTextColor="#94a3b8"
        multiline
        numberOfLines={4}
      />
      <Text style={styles.label}>Price (NGN)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        placeholder="0"
        placeholderTextColor="#94a3b8"
        keyboardType="number-pad"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
      </Pressable>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20 },
  backWrap: { marginBottom: 16 },
  backText: { fontSize: 16, color: TEAL, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  hint: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, color: '#0f172a', backgroundColor: '#fff' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  errorText: { fontSize: 14, color: '#dc2626', marginTop: 8 },
  saveBtn: { backgroundColor: TEAL, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
