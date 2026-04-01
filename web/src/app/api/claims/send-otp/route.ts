import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import {
  normalizePhone,
  isValidNigerianPhone,
  sendPhoneOtpViaTermii,
  isTermiiConfigured,
  formatPhoneDisplay,
} from '@/lib/phone-verify';
import { setClaimOtp } from '@/lib/claim-otp-cache';
import { isClaimableListingDoc } from '@/lib/claimable-listing';
import { assertCanSendClaimOtp, recordClaimOtpSent } from '@/lib/claim-otp-throttle';
import mongoose from 'mongoose';

/** POST /api/claims/send-otp — send Termii OTP to listing contact phone for claim verification */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isTermiiConfigured()) {
      return NextResponse.json({ error: 'Phone verification is not available. Please try again later.' }, { status: 503 });
    }

    await dbConnect();

    const throttle = await assertCanSendClaimOtp(session.user.id);
    if (throttle) {
      const status = throttle.code === 'OTP_LOCKED' ? 403 : 429;
      return NextResponse.json(
        { error: throttle.error, code: throttle.code, retryAfter: throttle.retryAfter },
        { status }
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

    await recordClaimOtpSent(session.user.id);
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
