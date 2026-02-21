import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { USER_ROLES, SUBSCRIPTION_TIERS } from '@/lib/constants';
import mongoose from 'mongoose';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    await dbConnect();
    const user = await User.findById(id).select('name email role phone image subscriptionTier createdAt').lean();
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    const body = await req.json();
    await dbConnect();
    const update: Record<string, unknown> = {};
    if (typeof body.name === 'string') update.name = body.name.trim();
    if (typeof body.email === 'string') {
      const email = body.email.trim();
      if (email) {
        const existing = await User.findOne({ email, _id: { $ne: id } });
        if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        update.email = email;
      }
    }
    if (typeof body.phone === 'string') update.phone = body.phone.trim() || undefined;
    if (typeof body.image === 'string') update.image = body.image.trim() || undefined;
    if (Object.values(USER_ROLES).includes(body.role)) update.role = body.role;
    if (Object.values(SUBSCRIPTION_TIERS).includes(body.subscriptionTier)) update.subscriptionTier = body.subscriptionTier;
    if (body.password && typeof body.password === 'string' && body.password.length >= 8) {
      const bcrypt = await import('bcryptjs');
      update.password = await bcrypt.default.hash(body.password, 12);
    }
    const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true })
      .select('name email role phone image subscriptionTier createdAt')
      .lean();
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    if (session.user.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }
    await dbConnect();
    const user = await User.findByIdAndDelete(id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
