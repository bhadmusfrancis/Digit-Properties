import { NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';
import { signToken } from '@/lib/auth-token';

type SocialPayload = {
  provider: 'google' | 'facebook' | 'apple';
  idToken?: string;       // Google
  accessToken?: string;  // Facebook (or use code + redirectUri)
  code?: string;         // Facebook auth code
  redirectUri?: string;  // Facebook redirect URI used in auth
  identityToken?: string; // Apple
  email?: string;        // Apple (may be missing on subsequent logins)
  name?: string;         // Apple fullName given only on first sign-in
};

function getGoogleAudience(): string[] {
  const web = process.env.GOOGLE_CLIENT_ID;
  const ios = process.env.GOOGLE_IOS_CLIENT_ID;
  const android = process.env.GOOGLE_ANDROID_CLIENT_ID;
  return [web, ios, android].filter(Boolean) as string[];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SocialPayload;
    const { provider } = body;
    if (!['google', 'facebook', 'apple'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    let email: string;
    let name: string;

    if (provider === 'google' && body.idToken) {
      const audience = getGoogleAudience();
      if (audience.length === 0) {
        return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 503 });
      }
      const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
      const { payload } = await jwtVerify(body.idToken, JWKS, {
        issuer: 'https://accounts.google.com',
        audience,
      });
      email = (payload.email as string) || '';
      name = (payload.name as string) || (payload.email as string)?.split('@')[0] || 'User';
    } else if (provider === 'facebook') {
      let accessToken = body.accessToken;
      if (!accessToken && body.code && body.redirectUri) {
        const cid = process.env.FACEBOOK_CLIENT_ID;
        const secret = process.env.FACEBOOK_CLIENT_SECRET;
        if (!cid || !secret) {
          return NextResponse.json({ error: 'Facebook OAuth not configured' }, { status: 503 });
        }
        const tokenRes = await fetch(
          `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${encodeURIComponent(cid)}&client_secret=${encodeURIComponent(secret)}&redirect_uri=${encodeURIComponent(body.redirectUri)}&code=${encodeURIComponent(body.code)}`
        );
        if (!tokenRes.ok) {
          return NextResponse.json({ error: 'Facebook token exchange failed' }, { status: 401 });
        }
        const tokenData = (await tokenRes.json()) as { access_token?: string };
        accessToken = tokenData.access_token;
      }
      if (!accessToken) {
        return NextResponse.json({ error: 'accessToken or code+redirectUri required for Facebook' }, { status: 400 });
      }
      const res = await fetch(
        `https://graph.facebook.com/me?fields=id,email,name&access_token=${encodeURIComponent(accessToken)}`
      );
      if (!res.ok) {
        return NextResponse.json({ error: 'Invalid Facebook token' }, { status: 401 });
      }
      const data = (await res.json()) as { email?: string; name?: string };
      email = data.email || '';
      name = data.name || 'User';
      if (!email) {
        return NextResponse.json({ error: 'Facebook email permission required' }, { status: 400 });
      }
    } else if (provider === 'apple' && body.identityToken) {
      const appleClientId = process.env.APPLE_CLIENT_ID || process.env.APPLE_SERVICE_ID;
      if (!appleClientId) {
        return NextResponse.json({ error: 'Apple OAuth not configured' }, { status: 503 });
      }
      const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
      const { payload } = await jwtVerify(body.identityToken, JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: appleClientId,
      });
      email = (payload.email as string) || body.email || '';
      name = body.name?.trim() || (payload.email as string)?.split('@')[0] || 'User';
      if (!email) {
        return NextResponse.json({ error: 'Apple email required' }, { status: 400 });
      }
    } else {
      return NextResponse.json(
        { error: provider === 'google' ? 'idToken required' : provider === 'facebook' ? 'accessToken or code+redirectUri required' : 'identityToken required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    await dbConnect();
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: name || email.split('@')[0],
        role: USER_ROLES.GUEST,
      });
    }
    const role = user.role ?? USER_ROLES.GUEST;
    const token = signToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role,
    });
    return NextResponse.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role,
      },
    });
  } catch (e) {
    console.error('[mobile-social]', e);
    return NextResponse.json({ error: 'Social sign-in failed' }, { status: 401 });
  }
}
