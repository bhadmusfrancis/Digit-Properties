import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import PageView from '@/models/PageView';
import { getSession } from '@/lib/get-session';
import { getRequestCountryCode, countryDisplayName } from '@/lib/request-geo';
import { isBotUserAgent, normalizeReferrer, shouldTrackPath } from '@/lib/analytics-track';
import { USER_ROLES } from '@/lib/constants';

const SESSION_COOKIE = 'dp_visitor';
const SESSION_MAX_AGE_SEC = 30 * 60;
const DEDUPE_WINDOW_MS = 30_000;

type PageViewBody = {
  path?: string;
  referrer?: string;
  sessionId?: string;
};

function readSessionId(req: Request, bodySessionId?: string): string {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)dp_visitor=([^;]+)/);
  const fromCookie = match?.[1]?.trim();
  if (fromCookie) return fromCookie;
  if (bodySessionId?.trim()) return bodySessionId.trim();
  return crypto.randomUUID();
}

export async function POST(req: Request) {
  try {
    const userAgent = req.headers.get('user-agent');
    if (isBotUserAgent(userAgent)) {
      return new NextResponse(null, { status: 204 });
    }

    const body = (await req.json().catch(() => ({}))) as PageViewBody;
    const path = body.path?.trim();
    if (!path || !shouldTrackPath(path)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const sessionId = readSessionId(req, body.sessionId);
    const country = getRequestCountryCode(req);
    const referrer = normalizeReferrer(body.referrer ?? req.headers.get('referer'));

    await dbConnect();

    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recent = await PageView.findOne({ sessionId, path, createdAt: { $gte: since } })
      .select('_id')
      .lean();
    if (recent) {
      const res = new NextResponse(null, { status: 204 });
      res.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_MAX_AGE_SEC,
        path: '/',
      });
      return res;
    }

    const session = await getSession(req);
    if (session?.user?.role === USER_ROLES.ADMIN) {
      return new NextResponse(null, { status: 204 });
    }

    const userId = session?.user?.id;

    await PageView.create({
      path,
      referrer,
      country,
      countryName: countryDisplayName(country),
      sessionId,
      userId: userId ?? undefined,
      userAgent: userAgent?.slice(0, 512) ?? undefined,
    });

    const res = new NextResponse(null, { status: 204 });
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE_SEC,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error('pageview track error', e);
    return new NextResponse(null, { status: 204 });
  }
}
