import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/db';
import Claim from '@/models/Claim';
import Listing from '@/models/Listing';
import { USER_ROLES } from '@/lib/constants';
import mongoose from 'mongoose';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const approve = body.approve !== false;

    await dbConnect();
    const claim = await Claim.findById(id);
    if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (claim.status !== 'pending') {
      return NextResponse.json({ error: 'Claim already processed' }, { status: 400 });
    }

    if (approve) {
      await Listing.findByIdAndUpdate(claim.listingId, {
        createdBy: claim.userId,
        createdByType: 'user',
      });
      claim.status = 'approved';
    } else {
      claim.status = 'rejected';
      claim.rejectionReason = body.reason || 'Claim rejected by admin';
    }
    claim.reviewedBy = new mongoose.Types.ObjectId(session.user.id);
    claim.reviewedAt = new Date();
    await claim.save();

    return NextResponse.json(claim);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to process claim' }, { status: 500 });
  }
}
