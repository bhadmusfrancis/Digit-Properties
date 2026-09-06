import { NextResponse } from 'next/server';
import {
  createOAuthState,
  getAppOrigin,
  isAllowedMobileRedirect,
  mobileOAuthCallbackUrl,
  type MobileOAuthProvider,
} from '@/lib/mobile-oauth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') as MobileOAuthProvider | null;
  const redirectUri = url.searchParams.get('redirect_uri') || '';

  if (provider !== 'google' && provider !== 'facebook') {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }
  if (!isAllowedMobileRedirect(redirectUri)) {
    return NextResponse.json({ error: 'Invalid redirect_uri' }, { status: 400 });
  }

  const origin = getAppOrigin(req);
  const callback = mobileOAuthCallbackUrl(origin);
  const state = createOAuthState(provider, redirectUri);

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 503 });
    }
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.searchParams.set('client_id', clientId);
    auth.searchParams.set('redirect_uri', callback);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('scope', 'openid email profile');
    auth.searchParams.set('state', state);
    auth.searchParams.set('prompt', 'select_account');
    return NextResponse.redirect(auth.toString());
  }

  const clientId = process.env.FACEBOOK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Facebook OAuth not configured' }, { status: 503 });
  }
  const auth = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('redirect_uri', callback);
  auth.searchParams.set('state', state);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'email,public_profile');
  return NextResponse.redirect(auth.toString());
}
