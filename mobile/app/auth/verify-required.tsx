import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApiUrl } from '../../lib/api';

export default function VerifyRequiredScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState('');

  const handleResend = async () => {
    if (!email?.trim()) {
      setResendError('Email missing');
      return;
    }
    setResendError('');
    setResendStatus('sending');
    try {
      const res = await fetch(getApiUrl('auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResendStatus('sent');
      } else {
        setResendStatus('error');
        setResendError((data as { error?: string }).error || 'Failed to resend');
      }
    } catch {
      setResendStatus('error');
      setResendError('Network error');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.card}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We sent a verification link to {email || 'your email'}. Tap the link to verify your account, then sign in.
        </Text>
        <Text style={styles.hint}>The link expires in 24 hours. Check spam if you don't see it.</Text>
        {email ? (
          <Pressable
            style={[styles.resendBtn, resendStatus === 'sending' && styles.resendDisabled]}
            onPress={handleResend}
            disabled={resendStatus === 'sending'}
          >
            {resendStatus === 'sending' ? (
              <ActivityIndicator size="small" color="#0d9488" />
            ) : (
              <Text style={styles.resendText}>
                {resendStatus === 'sent' ? 'Sent! Check your email.' : "Didn't get it? Resend verification email"}
              </Text>
            )}
          </Pressable>
        ) : null}
        {resendError ? <Text style={styles.errorText}>{resendError}</Text> : null}
        <Pressable style={styles.button} onPress={() => router.replace('/auth/signin')}>
          <Text style={styles.buttonText}>Go to sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  body: { fontSize: 15, color: '#334155', marginTop: 12, lineHeight: 22 },
  hint: { fontSize: 13, color: '#64748b', marginTop: 12 },
  resendBtn: { marginTop: 16, paddingVertical: 10 },
  resendDisabled: { opacity: 0.7 },
  resendText: { fontSize: 15, color: '#0d9488', fontWeight: '600' },
  errorText: { fontSize: 13, color: '#dc2626', marginTop: 6 },
  button: {
    marginTop: 24,
    backgroundColor: '#0d9488',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
