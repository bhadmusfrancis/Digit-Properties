import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { consumeRateLimit } from '@/lib/rate-limit';
import { USER_ROLES } from '@/lib/constants';

const RATE_PREFIX = 'liveness';
const MAX_LIVENESS_ATTEMPTS = 5;

/**
 * POST /api/me/liveness
 * Accept liveness capture. The client must use the device camera flow (LivenessCamera) which captures
 * a frame and uploads it; this endpoint accepts the resulting image URL. Liveness is camera-only (no upload/URL bypass in UI).
 */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const rate = consumeRateLimit(req, RATE_PREFIX);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429 }
      );
    }
    const body = await req.json();
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Valid image URL required' }, { status: 400 });
    }
    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role === USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Admins do not require liveness verification' }, { status: 400 });
    }
    user.image = imageUrl;
    user.livenessVerifiedAt = new Date();
    user.profilePictureLocked = true;
    await user.save();
    return NextResponse.json({
      ok: true,
      message: 'Liveness verified. This is now your profile picture until you become a Registered Agent or Developer.',
      imageUrl,
    });
  } catch (e) {
    console.error('[liveness]', e);
    return NextResponse.json({ error: 'Liveness verification failed' }, { status: 500 });
  }
}
