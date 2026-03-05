import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

/** POST /api/me/accept-legal — record acceptance of Terms of Service and Privacy Policy */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const now = new Date();
    await dbConnect();
    await User.findByIdAndUpdate(session.user.id, {
      $set: { termsAcceptedAt: now, privacyAcceptedAt: now },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[accept-legal]', e);
    return NextResponse.json({ error: 'Failed to record acceptance' }, { status: 500 });
  }
}
