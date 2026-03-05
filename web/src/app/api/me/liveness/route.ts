import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import VerificationRequest, {
  VERIFICATION_REQUEST_STATUS,
} from '@/models/VerificationRequest';
import { consumeRateLimit } from '@/lib/rate-limit';
import { USER_ROLES } from '@/lib/constants';
import { sendAdminNewVerificationRequest } from '@/lib/email';
import { livenessSchema } from '@/lib/validations';

const RATE_PREFIX = 'liveness';
const MAX_LIVENESS_ATTEMPTS = 5;

/**
 * POST /api/me/liveness
 * Accept liveness capture. The client must use the device camera flow (LivenessCamera) which captures
 * a frame and uploads it; this endpoint accepts the resulting image URL. Liveness is camera-only (no upload/URL bypass in UI).
 * On success, creates an initial verification request (Verified Individual) and notifies admin for approval.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const rate = consumeRateLimit(req, RATE_PREFIX);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const parsed = livenessSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json({ error: first?.message ?? 'Valid image URL required' }, { status: 400 });
    }
    const { imageUrl } = parsed.data;
    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role === USER_ROLES.ADMIN) {
      return NextResponse.json({ error: 'Admins do not require liveness verification' }, { status: 400 });
    }
    user.image = imageUrl;
    user.livenessVerifiedAt = new Date();
    await user.save();

    // Send initial verification to admin for approval (ID + liveness = Verified Individual request)
    const documentUrls = [user.idFrontUrl, user.idBackUrl, user.image].filter(
      (u): u is string => typeof u === 'string' && u.startsWith('http')
    );
    const existingPending = await VerificationRequest.findOne({
      userId: user._id,
      type: 'verified_individual',
      status: VERIFICATION_REQUEST_STATUS.PENDING,
    });
    if (!existingPending && documentUrls.length > 0) {
      const doc = await VerificationRequest.create({
        userId: user._id,
        type: 'verified_individual',
        status: VERIFICATION_REQUEST_STATUS.PENDING,
        documentUrls,
        documentVerificationMethod: 'manual',
      });
      await sendAdminNewVerificationRequest(
        user.name,
        user.email,
        'Verified Individual (initial verification)',
        String(doc._id)
      ).catch((e) => console.error('[liveness] admin email:', e));
    }

    return NextResponse.json({
      ok: true,
      message: 'Liveness verified. Verification complete and sent to admin for approval. You can verify your phone or apply for Agent/Developer later.',
      imageUrl,
    });
  } catch (e) {
    console.error('[liveness]', e);
    return NextResponse.json({ error: 'Liveness verification failed' }, { status: 500 });
  }
}
