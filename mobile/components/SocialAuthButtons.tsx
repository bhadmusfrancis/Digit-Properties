import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../lib/api';
import {
  signInWithGoogle,
  signInWithFacebook,
  signInWithApple,
  isGoogleConfigured,
  isFacebookConfigured,
  isAppleAvailable,
} from '../lib/social-auth';

type Props = {
  onError: (message: string) => void;
  disabled?: boolean;
};

export function SocialAuthButtons({ onError, disabled }: Props) {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [loading, setLoading] = useState<'google' | 'facebook' | 'apple' | null>(null);

  const sendToBackend = async (body: Record<string, unknown>) => {
    const res = await fetch(getApiUrl('auth/mobile-social'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'Sign in failed');
    }
    if (data.token && data.user) {
      await setAuth(data.token, data.user);
      router.replace('/');
    } else {
      throw new Error('Invalid response');
    }
  };

  const handleGoogle = async () => {
    if (!isGoogleConfigured() || disabled || loading) return;
    setLoading('google');
    onError('');
    try {
      const payload = await signInWithGoogle();
      if (!payload || payload.provider !== 'google') {
        onError('Google Sign-In is not available in this build (e.g. Expo Go). Use a dev build for native sign-in.');
        return;
      }
      await sendToBackend({ provider: 'google', idToken: payload.idToken });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setLoading(null);
    }
  };

  const handleFacebook = async () => {
    if (!isFacebookConfigured() || disabled || loading) return;
    setLoading('facebook');
    onError('');
    try {
      const payload = await signInWithFacebook();
      if (!payload || payload.provider !== 'facebook') return;
      await sendToBackend({ provider: 'facebook', accessToken: payload.accessToken });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Facebook sign-in failed');
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    if (!isAppleAvailable() || disabled || loading) return;
    setLoading('apple');
    onError('');
    try {
      const payload = await signInWithApple();
      if (!payload || payload.provider !== 'apple') return;
      await sendToBackend({
        provider: 'apple',
        identityToken: payload.identityToken,
        email: payload.email,
        name: payload.name,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Apple sign-in failed');
    } finally {
      setLoading(null);
    }
  };

  const showGoogle = isGoogleConfigured();
  const showFacebook = isFacebookConfigured();
  const showApple = isAppleAvailable();

  if (!showGoogle && !showFacebook && !showApple) return null;

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.line} />
      </View>
      <View style={styles.row}>
        {showGoogle && (
          <Pressable
            style={[styles.socialBtn, loading && styles.socialBtnDisabled]}
            onPress={handleGoogle}
            disabled={!!loading}
          >
            {loading === 'google' ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <Text style={styles.socialBtnText}>Google</Text>
            )}
          </Pressable>
        )}
        {showFacebook && (
          <Pressable
            style={[styles.socialBtn, loading && styles.socialBtnDisabled]}
            onPress={handleFacebook}
            disabled={!!loading}
          >
            {loading === 'facebook' ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <Text style={styles.socialBtnText}>Facebook</Text>
            )}
          </Pressable>
        )}
        {showApple && (
          <Pressable
            style={[styles.socialBtn, styles.appleBtn, loading && styles.socialBtnDisabled]}
            onPress={handleApple}
            disabled={!!loading}
          >
            {loading === 'apple' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.appleBtnText}>Apple</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24, marginBottom: 8 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  line: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { paddingHorizontal: 12, fontSize: 13, color: '#64748b' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  socialBtn: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnDisabled: { opacity: 0.7 },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  appleBtn: { backgroundColor: '#000' },
  appleBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
