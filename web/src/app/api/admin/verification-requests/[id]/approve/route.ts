import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import VerificationRequest, {
  VERIFICATION_REQUEST_STATUS,
  type VerificationRequestType,
} from '@/models/VerificationRequest';
import { USER_ROLES } from '@/lib/constants';
import { sendVerificationApproved } from '@/lib/email';
import mongoose from 'mongoose';

const ROLE_BY_TYPE: Record<VerificationRequestType, string> = {
  verified_individual: USER_ROLES.VERIFIED_INDIVIDUAL,
  registered_agent: USER_ROLES.REGISTERED_AGENT,
  registered_developer: USER_ROLES.REGISTERED_DEVELOPER,
};

/** POST /api/admin/verification-requests/[id]/approve */
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
    const documentVerificationMethod =
      body.documentVerificationMethod === 'automated' ||
      body.documentVerificationMethod === 'third_party'
        ? body.documentVerificationMethod
        : 'manual';
    await dbConnect();
    const request = await VerificationRequest.findById(id);
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (request.status !== VERIFICATION_REQUEST_STATUS.PENDING) {
      return NextResponse.json({ error: 'Request is not pending' }, { status: 400 });
    }
    const user = await User.findById(request.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const newRole = ROLE_BY_TYPE[request.type as VerificationRequestType];
    const update: Record<string, unknown> = {
      role: newRole,
      identityVerifiedAt: new Date(),
    };
    if (request.type === 'registered_agent' || request.type === 'registered_developer') {
      update.professionalVerifiedAt = new Date();
      update.profilePictureLocked = false;
      if (request.companyPosition) update.companyPosition = request.companyPosition;
    }
    await User.findByIdAndUpdate(request.userId, { $set: update });
    request.status = VERIFICATION_REQUEST_STATUS.APPROVED;
    request.reviewedBy = new mongoose.Types.ObjectId(session.user.id);
    request.reviewedAt = new Date();
    request.documentVerificationMethod = documentVerificationMethod;
    await request.save();
    const typeLabel =
      request.type === 'verified_individual'
        ? 'Verified Individual'
        : request.type === 'registered_agent'
          ? 'Registered Agent'
          : 'Registered Developer';
    await sendVerificationApproved(user.email, user.name, typeLabel).catch((e) =>
      console.error('[approve] email:', e)
    );
    return NextResponse.json({ ok: true, role: newRole });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
  }
}
