import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../../contexts/AuthContext';
import { getApiUrl } from '../../../../lib/api';

const ROLES = ['guest', 'verified_individual', 'registered_agent', 'registered_developer', 'admin'];

export default function AdminEditUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('guest');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || user?.role !== 'admin' || !id) {
      setLoading(false);
      return;
    }
    fetch(getApiUrl('admin/users/' + id), { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) return;
        setName(d.name || '');
        setEmail(d.email || '');
        setRole(d.role || 'guest');
      })
      .finally(() => setLoading(false));
  }, [token, user?.role, id]);

  const save = () => {
    if (!token || !id) return;
    setError('');
    setSaving(true);
    fetch(getApiUrl('admin/users/' + id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setError(d.error);
          return;
        }
        router.back();
      })
      .catch(() => setError('Failed to save'))
      .finally(() => setSaving(false));
  };

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.msg}>Admin only.</Text>
        <Pressable onPress={() => router.back()} style={styles.btn}><Text style={styles.btnText}>Back</Text></Pressable>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#0d9488" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.title}>Edit user</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" autoCapitalize="words" />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>Role</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <Pressable key={r} style={[styles.chip, role === r && styles.chipActive]} onPress={() => setRole(r)}>
              <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <Pressable style={[styles.saveBtn, saving && styles.saveDisabled]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  msg: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 12 },
  btn: { padding: 12 }, btnText: { color: '#0d9488', fontWeight: '600' },
  loader: { marginTop: 24 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backText: { fontSize: 16, color: '#0d9488', fontWeight: '500', marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  form: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 16 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#0d9488' },
  chipText: { fontSize: 14, color: '#475569' },
  chipTextActive: { color: '#fff' },
  err: { color: '#dc2626', marginBottom: 12 },
  saveBtn: { backgroundColor: '#0d9488', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
