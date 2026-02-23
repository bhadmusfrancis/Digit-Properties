import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl, API_URL } from '../../lib/api';
import { SocialAuthButtons } from '../../components/SocialAuthButtons';

export default function SignInScreen() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const e = email.trim();
    const p = password;
    if (!e || !p) {
      setError('Enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('auth/mobile-signin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, password: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as { error?: string; code?: string };
        if (res.status === 403 && err.code === 'NEED_VERIFICATION') {
          setError(err.error || 'Please verify your email before signing in. Check your inbox for the link.');
        } else {
          setError(err.error || 'Sign in failed');
        }
        return;
      }
      if (data.token && data.user) {
        await setAuth(data.token, data.user);
        router.replace('/');
      } else {
        setError('Invalid response');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <View style={styles.passwordRow}>
          <Text style={styles.label}>Password</Text>
          <Pressable onPress={() => Linking.openURL(`${API_URL.replace(/\/$/, '')}/auth/forgot-password`)}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          editable={!loading}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
        <SocialAuthButtons onError={setError} disabled={loading} />
        <Pressable style={styles.link} onPress={() => router.push('/auth/signup')}>
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingTop: 16 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155' },
  forgotLink: { fontSize: 14, color: '#0d9488', fontWeight: '500' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#0f172a',
  },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
  button: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#0ea5e9', fontSize: 15 },
});
