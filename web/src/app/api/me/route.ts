import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    const user = await User.findById(session.user.id)
      .select('name email image phone role subscriptionTier createdAt')
      .lean();
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const { name, phone, image } = body;
    await dbConnect();
    const update: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof phone === 'string') update.phone = phone.trim() || undefined;
    if (typeof image === 'string') update.image = image.trim() || undefined;
    const user = await User.findByIdAndUpdate(
      session.user.id,
      { $set: update },
      { new: true }
    )
      .select('name email image phone role subscriptionTier createdAt')
      .lean();
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
