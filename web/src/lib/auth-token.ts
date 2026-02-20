import { createHmac } from 'crypto';

const ALG = 'HS256';
const TTL_SEC = 30 * 24 * 60 * 60; // 30 days

export type TokenPayload = {
  id: string;
  email: string;
  name: string;
  role: string;
  iat?: number;
  exp?: number;
};

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  return Buffer.from(base64 + (pad ? '='.repeat(4 - pad) : ''), 'base64');
}

export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for mobile auth');
  const now = Math.floor(Date.now() / 1000);
  const data: TokenPayload = { ...payload, iat: now, exp: now + TTL_SEC };
  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: ALG, typ: 'JWT' })));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(data)));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payloadB64}`)
    .digest();
  return `${header}.${payloadB64}.${base64UrlEncode(signature)}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const signature = createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    if (base64UrlEncode(signature) !== sigB64) return null;
    const raw = base64UrlDecode(payloadB64).toString('utf8');
    const data = JSON.parse(raw) as TokenPayload;
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}
