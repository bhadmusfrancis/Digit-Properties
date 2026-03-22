import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import VerificationRequest, { VERIFICATION_REQUEST_STATUS } from '@/models/VerificationRequest';
import { USER_ROLES } from '@/lib/constants';
import { sendVerificationRejected } from '@/lib/email';
import mongoose from 'mongoose';

/** POST /api/admin/verification-requests/[id]/reject */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id || session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    const body = await req.json();
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : undefined;
    await dbConnect();
    const request = await VerificationRequest.findById(id);
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (request.status !== VERIFICATION_REQUEST_STATUS.PENDING) {
      return NextResponse.json({ error: 'Request is not pending' }, { status: 400 });
    }
    const user = await User.findById(request.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    request.status = VERIFICATION_REQUEST_STATUS.REJECTED;
    request.reviewedBy = new mongoose.Types.ObjectId(session.user.id);
    request.reviewedAt = new Date();
    request.rejectionReason = reason;
    await request.save();
    // When rejecting Verified Individual, clear ID and liveness so user can re-edit profile and re-upload ID
    if (request.type === 'verified_individual') {
      await User.findByIdAndUpdate(request.userId, {
        $unset: { identityVerifiedAt: 1, livenessVerifiedAt: 1 },
      });
    }
    const typeLabel =
      request.type === 'verified_individual'
        ? 'Verified Individual'
        : request.type === 'registered_agent'
          ? 'Registered Agent'
          : 'Registered Developer';
    await sendVerificationRejected(user.email, user.name, typeLabel, reason).catch((e) =>
      console.error('[reject] email:', e)
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
  }
}
