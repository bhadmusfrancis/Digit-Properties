import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { verifyTermiiPin, normalizePhone } from '@/lib/phone-verify';
import { getClaimOtp, deleteClaimOtp } from '@/lib/claim-otp-cache';
import ClaimPhoneVerification from '@/models/ClaimPhoneVerification';
import { claimableListingsMatch } from '@/lib/claimable-listing';
import {
  assertClaimOtpNotLocked,
  recordClaimVerifyFailure,
  recordClaimVerifySuccess,
} from '@/lib/claim-otp-throttle';

/** POST /api/claims/verify-otp — verify Termii OTP; return all bot listings for that phone and record verification */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const locked = await assertClaimOtpNotLocked(session.user.id);
    if (locked) {
      return NextResponse.json(
        { error: locked.error, code: locked.code, retryAfter: locked.retryAfter },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { pinId, pin } = body;
    if (!pinId || typeof pin !== 'string' || !pin.trim()) {
      return NextResponse.json({ error: 'pinId and pin are required' }, { status: 400 });
    }

    const entry = getClaimOtp(pinId);
    if (!entry) {
      const { lockedUntil } = await recordClaimVerifyFailure(session.user.id);
      if (lockedUntil) {
        return NextResponse.json(
          {
            error:
              'Too many failed attempts. Claim verification codes are disabled for your account for 24 hours.',
            code: 'OTP_LOCKED',
            retryAfter: lockedUntil.toISOString(),
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Code expired or invalid. Request a new code.', code: 'OTP_EXPIRED' }, { status: 400 });
    }

    if (entry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const verifyResult = await verifyTermiiPin(pinId, pin);
    if (!verifyResult.ok) {
      const { lockedUntil } = await recordClaimVerifyFailure(session.user.id);
      if (lockedUntil) {
        return NextResponse.json(
          {
            error:
              'Too many failed attempts. Claim verification codes are disabled for your account for 24 hours.',
            code: 'OTP_LOCKED',
            retryAfter: lockedUntil.toISOString(),
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: verifyResult.error || 'Invalid or expired code', code: 'OTP_INVALID' },
        { status: 400 }
      );
    }

    await recordClaimVerifySuccess(session.user.id);
    deleteClaimOtp(pinId);

    await ClaimPhoneVerification.findOneAndUpdate(
      { userId: session.user.id, phone: entry.phone },
      { $set: { verifiedAt: new Date() } },
      { upsert: true }
    );

    const claimMatch = await claimableListingsMatch();
    const allBot = await Listing.find(claimMatch)
      .select('_id title price listingType location status agentPhone')
      .sort({ createdAt: -1 })
      .lean();
    const normalizedListings = allBot.filter((l) => {
      const p = (l as { agentPhone?: string }).agentPhone;
      if (!p) return false;
      return normalizePhone(p) === entry.phone;
    });

    return NextResponse.json({
      verified: true,
      phone: entry.phone,
      listings: normalizedListings.map((l) => ({
        _id: String(l._id),
        title: l.title,
        price: l.price,
        listingType: l.listingType,
        location: l.location,
        status: l.status,
      })),
    });
  } catch (e) {
    console.error('[claims/verify-otp]', e);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
