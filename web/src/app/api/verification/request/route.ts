import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import VerificationRequest, {
  VERIFICATION_REQUEST_TYPES,
  VERIFICATION_REQUEST_STATUS,
  type VerificationRequestType,
} from '@/models/VerificationRequest';
import { USER_ROLES } from '@/lib/constants';
import { consumeRateLimit } from '@/lib/rate-limit';
import { sendAdminNewVerificationRequest } from '@/lib/email';
import { verificationRequestSchema } from '@/lib/validations';

const REJECT_COOLDOWN_DAYS = 30;

/** GET /api/verification/request — list current user's verification requests */
export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    const list = await VerificationRequest.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json(list);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

/** POST /api/verification/request — create verification request (Verified Individual / Agent / Developer) */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const rate = consumeRateLimit(req, 'verification-request');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const parsed = verificationRequestSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { error: first?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }
    const { type, documentUrls: validUrls, companyPosition, message: rawMessage } = parsed.data;
    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!user.verifiedAt) {
      return NextResponse.json({ error: 'Verify your email first' }, { status: 400 });
    }
    const existingPending = await VerificationRequest.findOne({
      userId: session.user.id,
      type,
      status: VERIFICATION_REQUEST_STATUS.PENDING,
    });
    if (existingPending) {
      return NextResponse.json(
        { error: 'You already have a pending request for this type' },
        { status: 400 }
      );
    }
    const lastRejected = await VerificationRequest.findOne({
      userId: session.user.id,
      type,
      status: VERIFICATION_REQUEST_STATUS.REJECTED,
    })
      .sort({ reviewedAt: -1 })
      .lean();
    if (lastRejected?.reviewedAt) {
      const daysSince = (Date.now() - new Date(lastRejected.reviewedAt).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince < REJECT_COOLDOWN_DAYS) {
        return NextResponse.json(
          { error: `You can re-apply ${Math.ceil(REJECT_COOLDOWN_DAYS - daysSince)} days after your last rejection` },
          { status: 400 }
        );
      }
    }
    const doc = await VerificationRequest.create({
      userId: session.user.id,
      type,
      status: VERIFICATION_REQUEST_STATUS.PENDING,
      documentUrls: validUrls,
      companyPosition: companyPosition || undefined,
      message: rawMessage ?? undefined,
      documentVerificationMethod: 'manual',
    });
    const typeLabel =
      type === 'verified_individual'
        ? 'Verified Individual'
        : type === 'registered_agent'
          ? 'Registered Agent'
          : 'Registered Developer';
    await sendAdminNewVerificationRequest(
      user.name,
      user.email,
      typeLabel,
      String(doc._id)
    ).catch((e) => console.error('[verification-request] admin email:', e));
    const populated = await VerificationRequest.findById(doc._id).lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
