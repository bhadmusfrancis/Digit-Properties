import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';

/**
 * GET /api/auth/verify-phone?token=xxx
 * Verifies phone from link (e.g. sent by email when SMS not configured); redirects to dashboard profile.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token?.trim()) {
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?error=InvalidVerification`);
  }
  try {
    await dbConnect();
    const user = await User.findOne({
      phoneVerificationToken: token,
      phoneVerificationExpires: { $gt: new Date() },
    });
    if (!user) {
      return NextResponse.redirect(`${APP_URL}/dashboard/profile?error=InvalidOrExpired`);
    }
    user.phoneVerifiedAt = new Date();
    user.phoneVerificationToken = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationCode = undefined;
    await user.save();
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?phoneVerified=1`);
  } catch (e) {
    console.error('[verify-phone]', e);
    return NextResponse.redirect(`${APP_URL}/dashboard/profile?error=VerificationFailed`);
  }
}
