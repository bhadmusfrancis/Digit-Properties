import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';

/**
 * GET /api/auth/verify-email?token=xxx
 * Verifies email from link in verification email; redirects to signin.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token?.trim()) {
    return NextResponse.redirect(`${APP_URL}/auth/signin?error=InvalidVerification`);
  }
  try {
    await dbConnect();
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });
    if (!user) {
      return NextResponse.redirect(`${APP_URL}/auth/signin?error=InvalidOrExpired`);
    }
    user.verifiedAt = new Date();
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    return NextResponse.redirect(`${APP_URL}/auth/signin?verified=1`);
  } catch (e) {
    console.error('[verify-email]', e);
    return NextResponse.redirect(`${APP_URL}/auth/signin?error=VerificationFailed`);
  }
}
