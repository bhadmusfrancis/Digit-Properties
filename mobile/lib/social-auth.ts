import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import { API_URL } from './api';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) || '';
const FACEBOOK_APP_ID =
  (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_FACEBOOK_APP_ID) || '';

export type SocialPayload =
  | { provider: 'google'; idToken: string }
  | { provider: 'facebook'; accessToken: string }
  | { provider: 'apple'; identityToken: string; email?: string; name?: string };

/** Session returned by the HTTPS mobile OAuth bridge. */
export type BridgeSession = {
  token: string;
  user: { id: string; email: string; name: string; role: string };
};

export function isGoogleConfigured(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}

export function isFacebookConfigured(): boolean {
  return Boolean(FACEBOOK_APP_ID);
}

export function isAppleAvailable(): boolean {
  return Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) >= 13;
}

function oauthRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'digitproperties', path: 'auth/oauth' });
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return globalThis.atob(normalized + pad);
}

function parseBridgeResult(url: string): BridgeSession {
  const parsed = new URL(url);
  const err = parsed.searchParams.get('error');
  if (err) throw new Error(err);
  const token = parsed.searchParams.get('token');
  const userB64 = parsed.searchParams.get('user');
  if (!token || !userB64) throw new Error('Sign-in did not complete');
  const user = JSON.parse(decodeBase64Url(userB64)) as BridgeSession['user'];
  if (!user?.id || !user?.email) throw new Error('Invalid sign-in response');
  return { token, user };
}

/**
 * Opens the website OAuth bridge (Google or Facebook) and returns an app session.
 * Uses HTTPS callbacks so Google/Facebook consoles only need web redirect URIs.
 */
export async function signInWithOAuthBridge(provider: 'google' | 'facebook'): Promise<BridgeSession | null> {
  if (provider === 'google' && !isGoogleConfigured()) return null;
  if (provider === 'facebook' && !isFacebookConfigured()) return null;

  const redirectUri = oauthRedirectUri();
  const start = new URL(`${API_URL.replace(/\/$/, '')}/api/auth/mobile-oauth/start`);
  start.searchParams.set('provider', provider);
  start.searchParams.set('redirect_uri', redirectUri);

  const result = await WebBrowser.openAuthSessionAsync(start.toString(), redirectUri);
  if (result.type !== 'success' || !result.url) {
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    throw new Error(`${provider === 'google' ? 'Google' : 'Facebook'} sign-in failed`);
  }
  return parseBridgeResult(result.url);
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
