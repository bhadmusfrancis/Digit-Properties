import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { USER_ROLES } from '@/lib/constants';
import { meUpdateSchema } from '@/lib/validations';
import { normalizePhone, isValidNigerianPhone } from '@/lib/phone-verify';
import {
  getLastProfileImageChangeForCooldown,
  getNextProfilePictureChangeAt,
  isProfilePictureChangeAllowed,
} from '@/lib/profile-picture-cooldown';

const ME_SELECT =
  'name email phone role subscriptionTier createdAt companyPosition verifiedAt phoneVerifiedAt identityVerifiedAt professionalVerifiedAt livenessVerifiedAt profileImageChangedAt profilePictureLocked firstName middleName lastName dateOfBirth address idFrontUrl idBackUrl idType idScannedData livenessCentreImageUrl image';

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
    const u = user as Record<string, unknown>;
    let dateOfBirthSerialized: string | null = null;
    if (u.dateOfBirth != null) {
      if (u.dateOfBirth instanceof Date) {
        dateOfBirthSerialized = (u.dateOfBirth as Date).toISOString().slice(0, 10);
      } else if (typeof u.dateOfBirth === 'string') {
        const s = (u.dateOfBirth as string).trim();
        dateOfBirthSerialized = s.length >= 10 ? s.slice(0, 10) : s || null;
      }
    }
    return NextResponse.json({
      ...u,
      name: u.name ?? null,
      firstName: u.firstName ?? null,
      middleName: u.middleName ?? null,
      lastName: u.lastName ?? null,
      address: u.address ?? null,
      phone: u.phone ?? null,
      dateOfBirth: dateOfBirthSerialized,
      verifiedAt: u.verifiedAt != null ? (u.verifiedAt instanceof Date ? u.verifiedAt.toISOString() : u.verifiedAt) : null,
      phoneVerifiedAt: u.phoneVerifiedAt != null ? (u.phoneVerifiedAt instanceof Date ? u.phoneVerifiedAt.toISOString() : u.phoneVerifiedAt) : null,
      identityVerifiedAt: u.identityVerifiedAt != null ? (u.identityVerifiedAt instanceof Date ? u.identityVerifiedAt.toISOString() : u.identityVerifiedAt) : null,
      professionalVerifiedAt: u.professionalVerifiedAt != null ? (u.professionalVerifiedAt instanceof Date ? u.professionalVerifiedAt.toISOString() : u.professionalVerifiedAt) : null,
      livenessVerifiedAt: u.livenessVerifiedAt != null ? (u.livenessVerifiedAt instanceof Date ? u.livenessVerifiedAt.toISOString() : u.livenessVerifiedAt) : null,
      profileImageChangedAt:
        u.profileImageChangedAt != null
          ? (u.profileImageChangedAt instanceof Date ? u.profileImageChangedAt.toISOString() : u.profileImageChangedAt)
          : null,
      ...(() => {
        const last = getLastProfileImageChangeForCooldown({
          profileImageChangedAt: u.profileImageChangedAt as Date | string | null | undefined,
          livenessVerifiedAt: u.livenessVerifiedAt as Date | string | null | undefined,
          image: u.image as string | null | undefined,
        });
        const nextAt = getNextProfilePictureChangeAt(last);
        return {
          canChangeProfilePicture: isProfilePictureChangeAllowed(last),
          nextProfileImageChangeAt: nextAt ? nextAt.toISOString() : null,
        };
      })(),
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
    const body = await req.json().catch(() => ({}));
    const parsed = meUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json({ error: first?.message ?? 'Invalid input' }, { status: 400 });
    }
    const data = parsed.data;
    await dbConnect();
    const existing = await User.findById(session.user.id).lean();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    /** Lock name, DOB, address once ID is verified. Lock phone once phone is verified. */
    const identityVerified = !!(existing as { identityVerifiedAt?: Date }).identityVerifiedAt;
    const phoneVerified = !!(existing as { phoneVerifiedAt?: Date }).phoneVerifiedAt;
    const set: Record<string, unknown> = {};
    if (!identityVerified) {
      if (data.name !== undefined) {
        set.name = data.name || ((existing as { name?: string }).name || 'User');
      }
      if (data.firstName !== undefined) set.firstName = data.firstName || null;
      if (data.lastName !== undefined) set.lastName = data.lastName || null;
      if (data.middleName !== undefined) set.middleName = data.middleName || null;
      if (data.dateOfBirth !== undefined) {
        const d = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
        set.dateOfBirth = d && !Number.isNaN(d.getTime()) ? d : null;
      }
      if (data.address !== undefined) set.address = data.address || null;
    }
    if (!phoneVerified && data.phone !== undefined) {
      const value = (data.phone || '').trim();
      if (!value) {
        set.phone = null;
      } else {
        const normalized = normalizePhone(value);
        if (!isValidNigerianPhone(normalized)) {
          return NextResponse.json(
            { error: 'Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)' },
            { status: 400 }
          );
        }
        set.phone = normalized;
      }
    }
    if (data.image !== undefined) {
      const newUrl = (data.image || '').trim();
      const oldUrl = ((existing as { image?: string }).image || '').trim();
      if (newUrl !== oldUrl) {
        const last = getLastProfileImageChangeForCooldown({
          profileImageChangedAt: (existing as { profileImageChangedAt?: Date }).profileImageChangedAt,
          livenessVerifiedAt: (existing as { livenessVerifiedAt?: Date }).livenessVerifiedAt,
          image: oldUrl || undefined,
        });
        if (!isProfilePictureChangeAllowed(last)) {
          const nextAt = getNextProfilePictureChangeAt(last);
          return NextResponse.json(
            {
              error: `You can update your profile photo at most once every 6 months. You can change it again on or after ${
                nextAt
                  ? nextAt.toLocaleDateString('en-NG', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'the allowed date'
              }.`,
              code: 'PROFILE_IMAGE_COOLDOWN',
              nextAllowedAt: nextAt?.toISOString(),
            },
            { status: 403 }
          );
        }
        set.image = data.image;
        set.profileImageChangedAt = new Date();
      }
    }
    if (data.companyPosition !== undefined && ((existing as { role?: string }).role === USER_ROLES.REGISTERED_AGENT || (existing as { role?: string }).role === USER_ROLES.REGISTERED_DEVELOPER)) {
      set.companyPosition = data.companyPosition || null;
    }
    const id = typeof session.user.id === 'string' ? new mongoose.Types.ObjectId(session.user.id) : session.user.id;
    if (Object.keys(set).length > 0) {
      const updateResult = await User.updateOne({ _id: id }, { $set: set });
      if (updateResult.matchedCount === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    const user = await User.findById(id).select(ME_SELECT).lean();
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const u = user as Record<string, unknown>;
    let dobSerialized: string | null = null;
    if (u.dateOfBirth != null) {
      if (u.dateOfBirth instanceof Date) {
        dobSerialized = (u.dateOfBirth as Date).toISOString().slice(0, 10);
      } else if (typeof u.dateOfBirth === 'string') {
        const s = (u.dateOfBirth as string).trim();
        dobSerialized = s.length >= 10 ? s.slice(0, 10) : s || null;
      }
    }
    return NextResponse.json({
      ...u,
      firstName: u.firstName ?? null,
      middleName: u.middleName ?? null,
      lastName: u.lastName ?? null,
      address: u.address ?? null,
      phone: u.phone ?? null,
      dateOfBirth: dobSerialized,
      profileImageChangedAt:
        u.profileImageChangedAt != null
          ? (u.profileImageChangedAt instanceof Date ? u.profileImageChangedAt.toISOString() : u.profileImageChangedAt)
          : null,
      ...(() => {
        const last = getLastProfileImageChangeForCooldown({
          profileImageChangedAt: u.profileImageChangedAt as Date | string | null | undefined,
          livenessVerifiedAt: u.livenessVerifiedAt as Date | string | null | undefined,
          image: u.image as string | null | undefined,
        });
        const nextAt = getNextProfilePictureChangeAt(last);
        return {
          canChangeProfilePicture: isProfilePictureChangeAllowed(last),
          nextProfileImageChangeAt: nextAt ? nextAt.toISOString() : null,
        };
      })(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
