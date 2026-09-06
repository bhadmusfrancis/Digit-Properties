import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';
import { signToken } from '@/lib/auth-token';

const STATE_TTL_MS = 10 * 60 * 1000;

export type MobileOAuthProvider = 'google' | 'facebook';

type StatePayload = {
  p: MobileOAuthProvider;
  r: string;
  e: number;
  n: string;
};

function stateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required');
  return secret;
}

export function getAppOrigin(req: Request): string {
  try {
    const u = new URL(req.url);
    if (/digitproperties\.com$/i.test(u.hostname)) return u.origin;
  } catch {
    /* fall through */
  }
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, '');
  return 'https://www.digitproperties.com';
}

export function mobileOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/auth/mobile-oauth/callback`;
}

/** Only allow returning into the Digit Properties app scheme. */
export function isAllowedMobileRedirect(redirectUri: string): boolean {
  try {
    const u = new URL(redirectUri);
    return u.protocol === 'digitproperties:';
  } catch {
    return false;
  }
}

export function createOAuthState(provider: MobileOAuthProvider, redirectUri: string): string {
  const payload: StatePayload = {
    p: provider,
    r: redirectUri,
    e: Date.now() + STATE_TTL_MS,
    n: randomBytes(8).toString('hex'),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function parseOAuthState(state: string): StatePayload | null {
  try {
    const [body, sig] = state.split('.');
    if (!body || !sig) return null;
    const expected = createHmac('sha256', stateSecret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
    if (!payload?.p || !payload?.r || !payload?.e) return null;
    if (payload.e < Date.now()) return null;
    if (!isAllowedMobileRedirect(payload.r)) return null;
    if (payload.p !== 'google' && payload.p !== 'facebook') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function upsertSocialUser(email: string, name: string) {
  await dbConnect();
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      name: name || email.split('@')[0],
      role: USER_ROLES.GUEST,
      verifiedAt: new Date(),
    });
  } else if (!user.verifiedAt) {
    user.verifiedAt = new Date();
    await user.save();
  }
  const role = user.role ?? USER_ROLES.GUEST;
  const token = signToken({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role,
  });
  return {
    token,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role,
    },
  };
}

export function buildAppDeepLink(
  redirectUri: string,
  result: { token: string; user: { id: string; email: string; name: string; role: string } }
): string {
  const u = new URL(redirectUri);
  u.searchParams.set('token', result.token);
  u.searchParams.set('user', Buffer.from(JSON.stringify(result.user)).toString('base64url'));
  return u.toString();
}

export function buildAppErrorDeepLink(redirectUri: string, error: string): string {
  const u = new URL(redirectUri);
  u.searchParams.set('error', error);
  return u.toString();
}
