import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { getApiUrl } from '../../../lib/api';

type UserMe = {
  name?: string;
  email?: string;
  phone?: string;
  phoneVerifiedAt?: string | null;
  identityVerifiedAt?: string | null;
  livenessVerifiedAt?: string | null;
};

const TEAL = '#0d9488';
const SLATE_600 = '#475569';
const SLATE_900 = '#0f172a';

export default function DashboardProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token, signOut } = useAuth();
  const [me, setMe] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneSending, setPhoneSending] = useState(false);
  const [codeConfirming, setCodeConfirming] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'code'>('idle');

  const load = useCallback(() => {
    if (!token) return;
    fetch(getApiUrl('me'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setMe(data);
          setPhone(data.phone || '');
        }
      })
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const sendOtp = () => {
    if (!token || !phone.trim()) return;
    setPhoneMessage(null);
    setPhoneSending(true);
    fetch(getApiUrl('me/verify-phone'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: phone.trim() }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setPhoneMessage(d.error);
        } else {
          setStep('code');
          setPhoneMessage('Code sent. Enter it below.');
        }
      })
      .catch(() => setPhoneMessage('Failed to send code'))
      .finally(() => setPhoneSending(false));
  };

  const confirmCode = () => {
    if (!token || !code.trim()) return;
    setPhoneMessage(null);
    setCodeConfirming(true);
    fetch(getApiUrl('me/confirm-phone'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: code.trim() }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setPhoneMessage(d.error);
        } else {
          setStep('idle');
          setCode('');
          load();
          setPhoneMessage('Phone verified.');
        }
      })
      .catch(() => setPhoneMessage('Verification failed'))
      .finally(() => setCodeConfirming(false));
  };

  const topPad = (insets.top || 0) + 12;

  if (!token) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.msg}>Sign in to view profile.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <ActivityIndicator size="large" color={TEAL} style={styles.loader} />
      </View>
    );
  }

  const phoneVerified = !!me?.phoneVerifiedAt;
  const identityVerified = !!me?.identityVerifiedAt;
  const livenessVerified = !!me?.livenessVerifiedAt;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingTop: topPad }]}>
      <Pressable onPress={() => router.back()} style={styles.backWrap}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Profile & Verification</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{me?.name || user?.name || '—'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{me?.email || user?.email || '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Phone</Text>
        {phoneVerified ? (
          <Text style={[styles.value, styles.verified]}>✓ {me?.phone || phone || '—'} (verified)</Text>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 08012345678"
              placeholderTextColor={SLATE_600}
              keyboardType="phone-pad"
              editable={step === 'idle'}
            />
            {step === 'idle' ? (
              <Pressable style={styles.primaryBtn} onPress={sendOtp} disabled={phoneSending || !phone.trim()}>
                {phoneSending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Send verification code</Text>}
              </Pressable>
            ) : (
              <>
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={code}
                  onChangeText={setCode}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={SLATE_600}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Pressable style={styles.primaryBtn} onPress={confirmCode} disabled={codeConfirming || code.length < 4}>
                  {codeConfirming ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Confirm code</Text>}
                </Pressable>
                <Pressable onPress={() => { setStep('idle'); setCode(''); setPhoneMessage(null); }}>
                  <Text style={styles.linkText}>Use a different number</Text>
                </Pressable>
              </>
            )}
            {phoneMessage ? <Text style={styles.message}>{phoneMessage}</Text> : null}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>ID verification</Text>
        <Text style={styles.value}>{identityVerified ? '✓ Verified' : 'Not verified'}</Text>
        {!identityVerified && (
          <Text style={styles.hint}>Upload your ID in the app to verify your identity.</Text>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Liveness check</Text>
        <Text style={styles.value}>{livenessVerified ? '✓ Verified' : 'Not verified'}</Text>
        {!livenessVerified && (
          <Text style={styles.hint}>Complete the liveness step in the app after ID verification.</Text>
        )}
      </View>

      <Pressable style={styles.signOutBtn} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#f8fafc' },
  msg: { fontSize: 16, color: SLATE_600, textAlign: 'center', marginTop: 24 },
  container: { padding: 20, backgroundColor: '#f8fafc' },
  backWrap: { marginBottom: 16 },
  backText: { fontSize: 16, color: TEAL, fontWeight: '600' },
  loader: { marginTop: 24 },
  scroll: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: SLATE_900, marginBottom: 20 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 12, color: SLATE_600, textTransform: 'uppercase', marginBottom: 6 },
  value: { fontSize: 17, fontWeight: '600', color: SLATE_900 },
  verified: { color: '#0f766e' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, color: SLATE_900 },
  primaryBtn: { backgroundColor: TEAL, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  linkText: { fontSize: 14, color: TEAL, marginTop: 12 },
  message: { fontSize: 14, color: '#dc2626', marginTop: 8 },
  hint: { fontSize: 13, color: SLATE_600, marginTop: 6 },
  signOutBtn: { marginTop: 24, padding: 16, alignItems: 'center' },
  signOutText: { fontSize: 16, color: '#dc2626', fontWeight: '500' },
});
