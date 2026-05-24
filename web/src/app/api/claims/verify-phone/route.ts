import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Listing from '@/models/Listing';
import { isClaimableListingDoc } from '@/lib/claimable-listing';
import {
  CLAIM_PHONE_SUFFIX_LEN,
  formatPhoneClaimHint,
  suffixMatchesListingPhone,
} from '@/lib/claim-phone-suffix';
import { setClaimSuffixVerified } from '@/lib/claim-suffix-cache';
import { getListingClaimPhone } from '@/lib/listing-claim-phone';
import {
  assertClaimOtpNotLocked,
  recordClaimVerifyFailure,
} from '@/lib/claim-otp-throttle';
import mongoose from 'mongoose';

/** POST /api/claims/verify-phone — step 1: confirm last 5 digits; enables OTP send for final confirmation */
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
    const listingId = body.listingId;
    const suffix = typeof body.suffix === 'string' ? body.suffix.replace(/\D/g, '') : '';
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }
    if (suffix.length !== CLAIM_PHONE_SUFFIX_LEN) {
      return NextResponse.json(
        { error: `Enter the last ${CLAIM_PHONE_SUFFIX_LEN} digits of the listing phone number` },
        { status: 400 }
      );
    }

    const listing = await Listing.findById(listingId)
      .select('agentPhone agentEmail contactSource createdByType createdBy')
      .populate('createdBy', 'phone role')
      .lean();
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    if (!isClaimableListingDoc(listing)) {
      return NextResponse.json({ error: 'Only listings created by a bot account can be claimed' }, { status: 400 });
    }

    const phone = getListingClaimPhone(listing);
    if (!phone) {
      return NextResponse.json({ error: 'This listing has no contact phone to verify' }, { status: 400 });
    }

    if (!suffixMatchesListingPhone(suffix, phone)) {
      const { lockedUntil } = await recordClaimVerifyFailure(session.user.id);
      if (lockedUntil) {
        return NextResponse.json(
          {
            error:
              'Too many failed attempts. Claim verification is disabled for your account for 24 hours.',
            code: 'OTP_LOCKED',
            retryAfter: lockedUntil.toISOString(),
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Those digits do not match the listing contact number', code: 'SUFFIX_INVALID' },
        { status: 400 }
      );
    }

    setClaimSuffixVerified(session.user.id, phone, listingId);

    return NextResponse.json({
      suffixVerified: true,
      phoneHint: formatPhoneClaimHint(phone),
    });
  } catch (e) {
    console.error('[claims/verify-phone]', e);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
