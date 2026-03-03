import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';

const ME_SELECT =
  'name email image phone role subscriptionTier createdAt companyPosition verifiedAt phoneVerifiedAt identityVerifiedAt professionalVerifiedAt livenessVerifiedAt profilePictureLocked';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    let user = await User.findById(session.user.id).select(ME_SELECT).lean();
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const userRecord = user as Record<string, unknown>;
    if (!userRecord.verifiedAt) {
      const full = await User.findById(session.user.id).select('emailVerificationToken emailVerificationExpires').lean();
      const f = full as { emailVerificationToken?: string; emailVerificationExpires?: Date } | null;
      const noPending = !f?.emailVerificationToken || (f?.emailVerificationExpires && new Date() > f.emailVerificationExpires);
      if (noPending) {
        await User.findByIdAndUpdate(session.user.id, { $set: { verifiedAt: new Date() } });
        user = await User.findById(session.user.id).select(ME_SELECT).lean() ?? user;
      }
    }
    const canChangeProfilePicture =
      (user as { role?: string }).role === USER_ROLES.REGISTERED_AGENT ||
      (user as { role?: string }).role === USER_ROLES.REGISTERED_DEVELOPER ||
      (user as { role?: string }).role === USER_ROLES.ADMIN;
    const u = user as Record<string, unknown>;
    return NextResponse.json({
      ...u,
      verifiedAt: u.verifiedAt != null ? (u.verifiedAt instanceof Date ? u.verifiedAt.toISOString() : u.verifiedAt) : null,
      phoneVerifiedAt: u.phoneVerifiedAt != null ? (u.phoneVerifiedAt instanceof Date ? u.phoneVerifiedAt.toISOString() : u.phoneVerifiedAt) : null,
      identityVerifiedAt: u.identityVerifiedAt != null ? (u.identityVerifiedAt instanceof Date ? u.identityVerifiedAt.toISOString() : u.identityVerifiedAt) : null,
      professionalVerifiedAt: u.professionalVerifiedAt != null ? (u.professionalVerifiedAt instanceof Date ? u.professionalVerifiedAt.toISOString() : u.professionalVerifiedAt) : null,
      livenessVerifiedAt: u.livenessVerifiedAt != null ? (u.livenessVerifiedAt instanceof Date ? u.livenessVerifiedAt.toISOString() : u.livenessVerifiedAt) : null,
      canChangeProfilePicture: !!canChangeProfilePicture,
    });
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
    const { name, phone, image, companyPosition } = body;
    await dbConnect();
    const existing = await User.findById(session.user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const update: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof phone === 'string') update.phone = phone.trim() || undefined;
    const canChangeProfilePicture =
      existing.role === USER_ROLES.REGISTERED_AGENT ||
      existing.role === USER_ROLES.REGISTERED_DEVELOPER ||
      existing.role === USER_ROLES.ADMIN;
    if (typeof image === 'string' && image.trim()) {
      if (!canChangeProfilePicture && existing.profilePictureLocked) {
        return NextResponse.json(
          { error: 'Profile picture is set from liveness verification. You can change it after becoming a Registered Agent or Developer.' },
          { status: 403 }
        );
      }
      update.image = image.trim();
    }
    if (typeof companyPosition === 'string') {
      if (
        existing.role === USER_ROLES.REGISTERED_AGENT ||
        existing.role === USER_ROLES.REGISTERED_DEVELOPER
      ) {
        update.companyPosition = companyPosition.trim() || undefined;
      }
    }
    const user = await User.findByIdAndUpdate(
      session.user.id,
      { $set: update },
      { new: true }
    )
      .select(ME_SELECT)
      .lean();
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const canChange =
      (user as { role?: string }).role === USER_ROLES.REGISTERED_AGENT ||
      (user as { role?: string }).role === USER_ROLES.REGISTERED_DEVELOPER ||
      (user as { role?: string }).role === USER_ROLES.ADMIN;
    return NextResponse.json({ ...user, canChangeProfilePicture: !!canChange });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
