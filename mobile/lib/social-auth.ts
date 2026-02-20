import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

const GOOGLE_WEB_CLIENT_ID =
  (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) || '';
const FACEBOOK_APP_ID =
  (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_FACEBOOK_APP_ID) || '';

export type SocialPayload =
  | { provider: 'google'; idToken: string }
  | { provider: 'facebook'; accessToken: string }
  | { provider: 'apple'; identityToken: string; email?: string; name?: string };

/** Lazy-load Google Sign-In (requires native binary; not in Expo Go). Only require when user taps. */
function getGoogleSignInModule(): typeof import('@react-native-google-signin/google-signin') | null {
  if (!GOOGLE_WEB_CLIENT_ID) return null;
  try {
    return require('@react-native-google-signin/google-signin');
  } catch {
    return null;
  }
}

export function isGoogleConfigured(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}

export function isFacebookConfigured(): boolean {
  return Boolean(FACEBOOK_APP_ID);
}

export function isAppleAvailable(): boolean {
  return Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) >= 13;
}

export async function signInWithGoogle(): Promise<SocialPayload | null> {
  const GoogleSignIn = getGoogleSignInModule();
  if (!GoogleSignIn?.default) return null;
  try {
    GoogleSignIn.default.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
    const result = await GoogleSignIn.default.signIn();
    if (result.type !== 'success' || !result.data) return null;
    let idToken = result.data.idToken ?? null;
    if (!idToken) {
      const tokens = await GoogleSignIn.default.getTokens();
      idToken = tokens?.idToken ?? null;
    }
    if (!idToken) return null;
    return { provider: 'google', idToken };
  } catch {
    return null;
  }
}

export async function signInWithFacebook(): Promise<SocialPayload | null> {
  if (!FACEBOOK_APP_ID) return null;
  try {
    const redirectUri = AuthSession.makeRedirectUri({ path: 'auth/facebook', useProxy: true });
    const authUrl =
      `https://www.facebook.com/v18.0/dialog/oauth?client_id=${encodeURIComponent(FACEBOOK_APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token&scope=email,public_profile`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type !== 'success' || !result.url) return null;
    const hash = result.url.split('#')[1];
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) return null;
    return { provider: 'facebook', accessToken };
  } catch {
    return null;
  }
}

export async function signInWithApple(): Promise<SocialPayload | null> {
  if (!isAppleAvailable()) return null;
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });
    const identityToken = cred.identityToken || undefined;
    if (!identityToken) return null;
    const email = cred.email || undefined;
    const name = cred.fullName
      ? [cred.fullName.givenName, cred.fullName.familyName].filter(Boolean).join(' ')
      : undefined;
    return { provider: 'apple', identityToken, email, name };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}
