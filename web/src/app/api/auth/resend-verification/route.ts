import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { sendVerificationEmail } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
const VERIFY_EXPIRY_HOURS = 24;

/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 * Finds unverified user by email, issues new token, sends verification email.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    await dbConnect();
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }
    if (user.verifiedAt) {
      return NextResponse.json({ error: 'Account is already verified. You can sign in.' }, { status: 400 });
    }
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);
    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationExpires = emailVerificationExpires;
    await user.save();
    const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
    const result = await sendVerificationEmail(user.email, user.name, verifyUrl);
    if (!result.ok) {
      console.error('[resend-verification] send failed for', user.email);
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again later.' },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, message: 'Verification email sent. Check your inbox and spam folder.' });
  } catch (e) {
    console.error('[resend-verification]', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
