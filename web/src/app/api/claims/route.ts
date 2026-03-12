import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import Claim from '@/models/Claim';
import Listing from '@/models/Listing';
import User from '@/models/User';
import ClaimPhoneVerification from '@/models/ClaimPhoneVerification';
import { objectIdSchema } from '@/lib/validations';
import { CLAIM_STATUS, USER_ROLES } from '@/lib/constants';
import { sendAdminNewClaim, sendClaimApproved } from '@/lib/email';
import { hasBaseVerification } from '@/lib/verification';
import { normalizePhone } from '@/lib/phone-verify';
import mongoose from 'mongoose';

const CAN_CLAIM = [USER_ROLES.VERIFIED_INDIVIDUAL, USER_ROLES.REGISTERED_AGENT, USER_ROLES.REGISTERED_DEVELOPER];

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const listingIdParam = searchParams.get('listingId');
    if (listingIdParam && !objectIdSchema.safeParse(listingIdParam).success) {
      return NextResponse.json({ error: 'Invalid listingId' }, { status: 400 });
    }
    const filter: Record<string, unknown> =
      session.user.role === USER_ROLES.ADMIN ? {} : { userId: new mongoose.Types.ObjectId(session.user.id) };
    if (listingIdParam) filter.listingId = new mongoose.Types.ObjectId(listingIdParam);

    const claims = await Claim.find(filter).populate('listingId userId').sort({ createdAt: -1 }).lean();
    return NextResponse.json(claims);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || !CAN_CLAIM.includes(session.user.role as (typeof CAN_CLAIM)[number])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    const user = await User.findById(session.user.id)
      .select('verifiedAt phoneVerifiedAt identityVerifiedAt livenessVerifiedAt role')
      .lean();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!hasBaseVerification(user)) {
      return NextResponse.json(
        {
          error: 'Complete verification to submit a claim',
          code: 'VERIFICATION_REQUIRED',
          verificationUrl: '/dashboard/profile',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const userId = new mongoose.Types.ObjectId(session.user.id);

    // Bulk claim (phone-verified): body.listingIds array
    const bulkIds = body.listingIds;
    if (Array.isArray(bulkIds) && bulkIds.length > 0) {
      const validIds = bulkIds.filter((id: unknown) => typeof id === 'string' && objectIdSchema.safeParse(id).success);
      if (validIds.length === 0) {
        return NextResponse.json({ error: 'Invalid listing IDs' }, { status: 400 });
      }
      const listings = await Listing.find({
        _id: { $in: validIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
        createdByType: 'bot',
      }).lean();
      if (listings.length !== validIds.length) {
        return NextResponse.json({ error: 'One or more listings not found or not claimable' }, { status: 400 });
      }
      const verifiedPhones = await ClaimPhoneVerification.find({ userId }).select('phone').lean();
      const verifiedSet = new Set(verifiedPhones.map((v) => v.phone));
      const claimsCreated: { _id: string; listingId: string; status: string }[] = [];
      for (const listing of listings) {
        const listingObj = listing as { _id: mongoose.Types.ObjectId; agentPhone?: string; title?: string };
        const phone = listingObj.agentPhone ? normalizePhone(listingObj.agentPhone) : '';
        if (!phone || !verifiedSet.has(phone)) {
          return NextResponse.json(
            { error: 'Verify the listing phone first (OTP) to claim. One or more listings are not verified.' },
            { status: 403 }
          );
        }
        const existingClaim = await Claim.findOne({
          listingId: listingObj._id,
          userId,
          status: { $in: [CLAIM_STATUS.PENDING, CLAIM_STATUS.APPROVED] },
        });
        if (existingClaim) continue;
        const approvedClaim = await Claim.create({
          listingId: listingObj._id,
          userId,
          proofUrls: [],
          message: 'Claimed after phone verification',
          status: CLAIM_STATUS.APPROVED,
        });
        await Listing.findByIdAndUpdate(listingObj._id, {
          createdBy: userId,
          createdByType: 'user',
        });
        claimsCreated.push({
          _id: String(approvedClaim._id),
          listingId: String(listingObj._id),
          status: CLAIM_STATUS.APPROVED,
        });
      }
      const claimant = await User.findById(session.user.id).lean();
      const claimantEmail = (claimant?.email as string) || session.user.email || '';
      for (const c of claimsCreated) {
        const list = listings.find((l) => String((l as { _id: mongoose.Types.ObjectId })._id) === c.listingId) as { title?: string } | undefined;
        if (claimantEmail && list?.title) {
          sendClaimApproved(claimantEmail, list.title, c.listingId).catch((e) => console.error('[claims] approved email:', e));
        }
      }
      return NextResponse.json({ claims: claimsCreated, count: claimsCreated.length });
    }

    // Single claim: listingId required; proofUrls required unless phone was verified for this listing
    const singleParsed = objectIdSchema.safeParse(body.listingId);
    if (!singleParsed.success) {
      return NextResponse.json({ error: 'Invalid or missing listingId' }, { status: 400 });
    }
    const listingId = singleParsed.data;
    const proofUrlsRaw = Array.isArray(body.proofUrls) ? body.proofUrls : undefined;
    const message = typeof body.message === 'string' ? body.message : undefined;

    const listing = await Listing.findById(listingId).lean();
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    if (listing.createdByType !== 'bot') {
      return NextResponse.json({ error: 'Only listings created by BOT accounts can be claimed.' }, { status: 400 });
    }

    const existing = await Claim.findOne({
      listingId,
      status: CLAIM_STATUS.PENDING,
    });
    if (existing) {
      return NextResponse.json({ error: 'A claim is already pending for this listing' }, { status: 400 });
    }

    const listingPhone = (listing as { agentPhone?: string }).agentPhone
      ? normalizePhone((listing as { agentPhone: string }).agentPhone)
      : '';
    const phoneVerified = listingPhone
      ? await ClaimPhoneVerification.findOne({ userId, phone: listingPhone }).lean()
      : null;

    const status = phoneVerified ? CLAIM_STATUS.APPROVED : CLAIM_STATUS.PENDING;
    const proofUrls = phoneVerified ? [] : proofUrlsRaw;
    if (!proofUrls || proofUrls.length === 0) {
      if (!phoneVerified) {
        return NextResponse.json(
          { error: 'Add at least one proof document, or verify the listing phone with OTP first.' },
          { status: 400 }
        );
      }
    } else if (proofUrls.length > 10 || proofUrls.some((u: unknown) => typeof u !== 'string' || !/^https?:\/\//.test(u))) {
      return NextResponse.json({ error: 'Invalid proof URLs (1–10 valid URLs required)' }, { status: 400 });
    }

    const claim = await Claim.create({
      listingId,
      userId: session.user.id,
      proofUrls,
      message,
      status,
    });

    if (status === CLAIM_STATUS.APPROVED) {
      await Listing.findByIdAndUpdate(listingId, {
        createdBy: userId,
        createdByType: 'user',
      });
      const claimant = await User.findById(session.user.id).lean();
      const claimantEmail = (claimant?.email as string) || session.user.email || '';
      if (claimantEmail) {
        sendClaimApproved(claimantEmail, listing.title, String(listingId)).catch((e) =>
          console.error('[claims] approved email:', e)
        );
      }
    } else {
      const claimant = await User.findById(session.user.id).lean();
      const claimantName = claimant?.name || session.user.name || 'Unknown';
      const claimantEmail = (claimant?.email as string) || session.user.email || '';
      sendAdminNewClaim(listing.title, claimantName, claimantEmail, String(claim._id)).catch((e) =>
        console.error('[claims] admin email:', e)
      );
    }

    return NextResponse.json(claim);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 });
  }
}
