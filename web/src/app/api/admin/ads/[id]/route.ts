import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import UserAd from '@/models/UserAd';
import { USER_ROLES, USER_AD_STATUS } from '@/lib/constants';
import mongoose from 'mongoose';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ad ID' }, { status: 400 });
    }
    const body = await req.json();
    const { status, rejectionReason } = body as { status?: string; rejectionReason?: string };
    if (!status || ![USER_AD_STATUS.APPROVED, USER_AD_STATUS.REJECTED].includes(status as keyof typeof USER_AD_STATUS)) {
      return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
    }
    await dbConnect();
    const ad = await UserAd.findById(id);
    if (!ad) return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    if (ad.status !== USER_AD_STATUS.PENDING_APPROVAL) {
      return NextResponse.json({ error: 'Only pending ads can be approved/rejected' }, { status: 400 });
    }
    if (status === USER_AD_STATUS.APPROVED && !ad.paymentId) {
      return NextResponse.json({ error: 'Ad must be paid before approval' }, { status: 400 });
    }
    ad.status = status as 'approved' | 'rejected';
    ad.reviewedBy = session.user.id as unknown as mongoose.Types.ObjectId;
    if (status === USER_AD_STATUS.REJECTED && typeof rejectionReason === 'string') {
      ad.rejectionReason = rejectionReason;
    } else {
      ad.rejectionReason = undefined;
    }
    await ad.save();
    return NextResponse.json({
      ad: {
        _id: ad._id.toString(),
        status: ad.status,
        reviewedBy: ad.reviewedBy?.toString(),
        rejectionReason: ad.rejectionReason,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update ad' }, { status: 500 });
  }
}
