import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Claim from '@/models/Claim';
import Listing from '@/models/Listing';
import User from '@/models/User';
import { claimSchema } from '@/lib/validations';
import { CLAIM_STATUS, USER_ROLES } from '@/lib/constants';
import { sendAdminNewClaim } from '@/lib/email';
import mongoose from 'mongoose';

const CAN_CLAIM = [USER_ROLES.VERIFIED_INDIVIDUAL, USER_ROLES.REGISTERED_AGENT, USER_ROLES.REGISTERED_DEVELOPER];

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get('listingId');
    const filter: Record<string, unknown> =
      session.user.role === USER_ROLES.ADMIN ? {} : { userId: new mongoose.Types.ObjectId(session.user.id) };
    if (listingId) filter.listingId = new mongoose.Types.ObjectId(listingId);

    const claims = await Claim.find(filter).populate('listingId userId').sort({ createdAt: -1 }).lean();
    return NextResponse.json(claims);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !CAN_CLAIM.includes(session.user.role as (typeof CAN_CLAIM)[number])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await dbConnect();
    const listing = await Listing.findById(parsed.data.listingId);
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    if (!['admin', 'ai'].includes(listing.createdByType)) {
      return NextResponse.json({ error: 'This listing cannot be claimed' }, { status: 400 });
    }

    const existing = await Claim.findOne({
      listingId: parsed.data.listingId,
      status: CLAIM_STATUS.PENDING,
    });
    if (existing) {
      return NextResponse.json({ error: 'A claim is already pending for this listing' }, { status: 400 });
    }

    const claim = await Claim.create({
      ...parsed.data,
      userId: session.user.id,
      status: CLAIM_STATUS.PENDING,
    });

    const claimant = await User.findById(session.user.id).lean();
    const claimantName = claimant?.name || session.user.name || 'Unknown';
    const claimantEmail = (claimant?.email as string) || session.user.email || '';
    sendAdminNewClaim(listing.title, claimantName, claimantEmail, String(claim._id)).catch((e) =>
      console.error('[claims] admin email:', e)
    );

    return NextResponse.json(claim);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 });
  }
}
