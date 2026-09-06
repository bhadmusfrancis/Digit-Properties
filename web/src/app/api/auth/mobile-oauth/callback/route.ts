import { NextResponse } from 'next/server';
import {
  buildAppDeepLink,
  buildAppErrorDeepLink,
  getAppOrigin,
  mobileOAuthCallbackUrl,
  parseOAuthState,
  upsertSocialUser,
} from '@/lib/mobile-oauth';

async function exchangeGoogleCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth not configured');

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!tokenRes.ok) throw new Error('Google token exchange failed');
  const tokenData = (await tokenRes.json()) as { access_token?: string; id_token?: string };
  if (!tokenData.access_token) throw new Error('Google access token missing');

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileRes.ok) throw new Error('Google profile fetch failed');
  const profile = (await profileRes.json()) as { email?: string; name?: string };
  if (!profile.email) throw new Error('Google email required');
  return {
    email: profile.email,
    name: profile.name || profile.email.split('@')[0],
  };
}

async function exchangeFacebookCode(code: string, redirectUri: string) {
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Facebook OAuth not configured');

  const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', clientId);
  tokenUrl.searchParams.set('client_secret', clientSecret);
  tokenUrl.searchParams.set('redirect_uri', redirectUri);
  tokenUrl.searchParams.set('code', code);
  const tokenRes = await fetch(tokenUrl.toString());
  if (!tokenRes.ok) throw new Error('Facebook token exchange failed');
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new Error('Facebook access token missing');

  const profileRes = await fetch(
    `https://graph.facebook.com/me?fields=id,email,name&access_token=${encodeURIComponent(tokenData.access_token)}`
  );
  if (!profileRes.ok) throw new Error('Facebook profile fetch failed');
  const profile = (await profileRes.json()) as { email?: string; name?: string };
  if (!profile.email) throw new Error('Facebook email permission required');
  return {
    email: profile.email,
    name: profile.name || profile.email.split('@')[0],
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const parsed = state ? parseOAuthState(state) : null;
  const fallbackRedirect = 'digitproperties://auth/oauth';

  if (!parsed) {
    return NextResponse.redirect(buildAppErrorDeepLink(fallbackRedirect, 'Invalid or expired sign-in session'));
  }

  if (oauthError || !code) {
    return NextResponse.redirect(
      buildAppErrorDeepLink(parsed.r, oauthError === 'access_denied' ? 'Sign-in cancelled' : 'Sign-in failed')
    );
  }

  const origin = getAppOrigin(req);
  const callback = mobileOAuthCallbackUrl(origin);

  try {
    const profile =
      parsed.p === 'google'
        ? await exchangeGoogleCode(code, callback)
        : await exchangeFacebookCode(code, callback);
    const session = await upsertSocialUser(profile.email, profile.name);
    return NextResponse.redirect(buildAppDeepLink(parsed.r, session));
  } catch (e) {
    console.error('[mobile-oauth/callback]', e);
    const message = e instanceof Error ? e.message : 'Social sign-in failed';
    return NextResponse.redirect(buildAppErrorDeepLink(parsed.r, message));
  }
}
