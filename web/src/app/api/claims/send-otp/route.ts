import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { hasBaseVerification } from '@/lib/verification';
import { CLAIM_STATUS, USER_ROLES } from '@/lib/constants';
import {
  normalizePhone,
  isValidNigerianPhone,
  sendPhoneOtpViaTermii,
  isTermiiConfigured,
  formatPhoneDisplay,
} from '@/lib/phone-verify';
import { setClaimOtp } from '@/lib/claim-otp-cache';
import { isClaimableListingDoc } from '@/lib/claimable-listing';
import mongoose from 'mongoose';

const CAN_CLAIM = [USER_ROLES.VERIFIED_INDIVIDUAL, USER_ROLES.REGISTERED_AGENT, USER_ROLES.REGISTERED_DEVELOPER];

/** POST /api/claims/send-otp — send Termii OTP to listing contact phone for claim verification */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || !CAN_CLAIM.includes(session.user.role as (typeof CAN_CLAIM)[number])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isTermiiConfigured()) {
      return NextResponse.json({ error: 'Phone verification is not available. Please try again later.' }, { status: 503 });
    }

    await dbConnect();
    const user = await User.findById(session.user.id)
      .select('verifiedAt phoneVerifiedAt identityVerifiedAt livenessVerifiedAt role')
      .lean();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!hasBaseVerification(user)) {
      return NextResponse.json(
        { error: 'Complete verification to claim listings', code: 'VERIFICATION_REQUIRED', verificationUrl: '/dashboard/profile' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const listingId = body.listingId;
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }

    const listing = await Listing.findById(listingId)
      .select('agentPhone createdBy createdByType')
      .populate('createdBy', 'phone role')
      .lean();
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    if (!isClaimableListingDoc(listing)) {
      return NextResponse.json({ error: 'Only listings created by a bot account can be claimed' }, { status: 400 });
    }

    const creator = listing.createdBy as { phone?: string } | null;
    const rawPhone = listing.agentPhone || creator?.phone;
    if (!rawPhone || typeof rawPhone !== 'string') {
      return NextResponse.json({ error: 'This listing has no contact phone to verify' }, { status: 400 });
    }

    const phone = normalizePhone(rawPhone);
    if (!isValidNigerianPhone(phone)) {
      return NextResponse.json({ error: 'Listing contact phone is not a valid Nigerian number' }, { status: 400 });
    }

    const result = await sendPhoneOtpViaTermii(phone);
    if (!result.ok || !result.pinId) {
      return NextResponse.json(
        { error: result.error || 'Failed to send verification code' },
        { status: 503 }
      );
    }

    setClaimOtp(result.pinId, session.user.id, phone, listingId);
    return NextResponse.json({
      pinId: result.pinId,
      phoneDisplay: formatPhoneDisplay(phone),
    });
  } catch (e) {
    console.error('[claims/send-otp]', e);
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
