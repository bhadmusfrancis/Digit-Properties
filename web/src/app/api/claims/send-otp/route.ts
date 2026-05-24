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
import { getClaimSuffixVerified } from '@/lib/claim-suffix-cache';
import { getListingClaimPhone } from '@/lib/listing-claim-phone';
import { assertCanSendClaimOtp, recordClaimOtpSent } from '@/lib/claim-otp-throttle';
import { consumeRateLimit } from '@/lib/rate-limit';
import mongoose from 'mongoose';

const RATE_PREFIX = 'claims-send-otp';

/** POST /api/claims/send-otp — step 2: SMS OTP after last-6-digit check */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isTermiiConfigured()) {
      return NextResponse.json({ error: 'Phone verification is not available. Please try again later.' }, { status: 503 });
    }

    const rate = consumeRateLimit(req, RATE_PREFIX);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.', code: 'OTP_RATE_LIMIT' },
        { status: 429, headers: rate.retryAfter ? { 'Retry-After': String(rate.retryAfter) } : undefined }
      );
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

    const suffixPass = getClaimSuffixVerified(session.user.id, listingId);
    if (!suffixPass) {
      return NextResponse.json(
        { error: 'Enter the correct last 5 digits of the listing phone before requesting a code.', code: 'SUFFIX_REQUIRED' },
        { status: 400 }
      );
    }

    const listing = await Listing.findById(listingId)
      .select('agentPhone agentEmail contactSource createdByType createdBy')
      .populate('createdBy', 'phone role')
      .lean();
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

    const phone = getListingClaimPhone(listing);
    if (!phone || phone !== suffixPass.phone) {
      return NextResponse.json({ error: 'Listing phone mismatch. Confirm the last 5 digits again.' }, { status: 400 });
    }

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
    setClaimOtp(result.pinId, session.user.id, normalizePhone(phone), listingId);
    return NextResponse.json({
      pinId: result.pinId,
      phoneDisplay: formatPhoneDisplay(phone),
    });
  } catch (e) {
    console.error('[claims/send-otp]', e);
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
