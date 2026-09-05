import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

export type VerifiedSessionOk = {
  ok: true;
  session: Session;
  userId: string;
};

export type VerifiedSessionErr = {
  ok: false;
  response: NextResponse;
};

export async function requireVerifiedSession(req: Request): Promise<VerifiedSessionOk | VerifiedSessionErr> {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sign in with a verified email to continue.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      ),
    };
  }

  await dbConnect();
  const user = await User.findById(session.user.id).select('verifiedAt').lean();
  if (!user?.verifiedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Verify your email to continue.', code: 'EMAIL_NOT_VERIFIED' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, session, userId: session.user.id };
}
