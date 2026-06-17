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
    const user = await User.findById(id).select('name email role phone image subscriptionTier companyPosition createdAt verifiedAt phoneVerifiedAt identityVerifiedAt professionalVerifiedAt livenessVerifiedAt profilePictureLocked firstName lastName dateOfBirth address idFrontUrl idBackUrl livenessCentreImageUrl').lean();
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
    const existing = await User.findById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};

    if (typeof body.name === 'string') set.name = body.name.trim();
    if (typeof body.email === 'string') {
      const email = body.email.trim();
      if (email) {
        const emailTaken = await User.findOne({ email, _id: { $ne: id } });
        if (emailTaken) return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        set.email = email;
      }
    }
    if (typeof body.phone === 'string') set.phone = body.phone.trim() || undefined;
    if (typeof body.image === 'string') set.image = body.image.trim() || undefined;
    if (typeof body.companyPosition === 'string') set.companyPosition = body.companyPosition.trim() || undefined;
    if (Object.values(SUBSCRIPTION_TIERS).includes(body.subscriptionTier)) {
      set.subscriptionTier = body.subscriptionTier;
    }
    if (body.password && typeof body.password === 'string' && body.password.length >= 8) {
      const bcrypt = await import('bcryptjs');
      set.password = await bcrypt.default.hash(body.password, 12);
    }

    if (typeof body.markVerified === 'boolean') {
      if (body.markVerified) {
        if (existing.role === USER_ROLES.GUEST || existing.role === USER_ROLES.BOT) {
          set.role = USER_ROLES.VERIFIED_INDIVIDUAL;
          set.identityVerifiedAt = new Date();
        } else if (
          existing.role === USER_ROLES.VERIFIED_INDIVIDUAL ||
          existing.role === USER_ROLES.REGISTERED_AGENT ||
          existing.role === USER_ROLES.REGISTERED_DEVELOPER ||
          existing.role === USER_ROLES.ADMIN
        ) {
          // Already verified — no-op
        } else {
          return NextResponse.json({ error: 'User already has a verified role' }, { status: 400 });
        }
      } else if (existing.role === USER_ROLES.VERIFIED_INDIVIDUAL) {
        set.role = USER_ROLES.GUEST;
        unset.identityVerifiedAt = 1;
        unset.livenessVerifiedAt = 1;
      } else {
        return NextResponse.json(
          { error: 'Only verified individual accounts can have verification removed this way' },
          { status: 400 }
        );
      }
    }

    if (Object.values(USER_ROLES).includes(body.role)) {
      set.role = body.role;
      if (
        body.role === USER_ROLES.VERIFIED_INDIVIDUAL &&
        existing.role !== USER_ROLES.VERIFIED_INDIVIDUAL
      ) {
        set.identityVerifiedAt = new Date();
      }
      if (body.role === USER_ROLES.GUEST && existing.role === USER_ROLES.VERIFIED_INDIVIDUAL) {
        unset.identityVerifiedAt = 1;
        unset.livenessVerifiedAt = 1;
      }
    }

    const updateQuery: Record<string, unknown> = {};
    if (Object.keys(set).length > 0) updateQuery.$set = set;
    if (Object.keys(unset).length > 0) updateQuery.$unset = unset;
    if (Object.keys(updateQuery).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const user = await User.findByIdAndUpdate(id, updateQuery, { new: true })
      .select('name email role phone image subscriptionTier companyPosition createdAt verifiedAt phoneVerifiedAt identityVerifiedAt professionalVerifiedAt livenessVerifiedAt profilePictureLocked')
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
