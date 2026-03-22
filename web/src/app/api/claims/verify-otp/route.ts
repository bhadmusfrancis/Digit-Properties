import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { verifyTermiiPin, normalizePhone } from '@/lib/phone-verify';
import { getAndDeleteClaimOtp } from '@/lib/claim-otp-cache';
import ClaimPhoneVerification from '@/models/ClaimPhoneVerification';
import { USER_ROLES } from '@/lib/constants';
import { claimableListingsMatch } from '@/lib/claimable-listing';
import mongoose from 'mongoose';

const CAN_CLAIM = [USER_ROLES.VERIFIED_INDIVIDUAL, USER_ROLES.REGISTERED_AGENT, USER_ROLES.REGISTERED_DEVELOPER];

/** POST /api/claims/verify-otp — verify Termii OTP; return all bot listings for that phone and record verification */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || !CAN_CLAIM.includes(session.user.role as (typeof CAN_CLAIM)[number])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { pinId, pin, listingId: bodyListingId } = body;
    if (!pinId || typeof pin !== 'string' || !pin.trim()) {
      return NextResponse.json({ error: 'pinId and pin are required' }, { status: 400 });
    }

    const entry = getAndDeleteClaimOtp(pinId);
    if (!entry) {
      return NextResponse.json({ error: 'Code expired or invalid. Request a new code.' }, { status: 400 });
    }
    if (entry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const verifyResult = await verifyTermiiPin(pinId, pin);
    if (!verifyResult.ok) {
      return NextResponse.json({ error: verifyResult.error || 'Invalid or expired code' }, { status: 400 });
    }

    await dbConnect();

    // Record that this user verified this phone (for auto-approve on claim)
    await ClaimPhoneVerification.findOneAndUpdate(
      { userId: session.user.id, phone: entry.phone },
      { $set: { verifiedAt: new Date() } },
      { upsert: true }
    );

    // Find all claimable bot listings; filter by normalized agentPhone matching verified phone
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
