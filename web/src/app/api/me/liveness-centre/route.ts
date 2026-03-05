import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

/** Save liveness "centre your head" capture URL for admin review. Only accepts URLs from our upload (no link paste). */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Valid image URL required from camera capture.' }, { status: 400 });
    }
    // Only allow URLs from our Cloudinary (upload flow), not arbitrary links
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const allowed = cloudName && imageUrl.includes('cloudinary.com') && imageUrl.includes(cloudName);
    if (!allowed) {
      return NextResponse.json({ error: 'Image must be from verification upload.' }, { status: 400 });
    }
    await dbConnect();
    await User.findByIdAndUpdate(session.user.id, { $set: { livenessCentreImageUrl: imageUrl } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[liveness-centre]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
