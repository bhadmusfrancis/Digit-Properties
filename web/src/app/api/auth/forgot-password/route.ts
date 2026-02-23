import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { sendPasswordResetEmail } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com';
const RESET_EXPIRY_HOURS = 1;

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 * If user exists with a password (credentials account), creates reset token and sends email.
 * Always returns 200 with same message to avoid email enumeration.
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
    const message = 'If an account exists with this email, you will receive a password reset link.';
    if (!user || !user.password) {
      return NextResponse.json({ ok: true, message });
    }
    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetExpires = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);
    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();
    const resetUrl = `${APP_URL}/auth/reset-password?token=${encodeURIComponent(passwordResetToken)}`;
    await sendPasswordResetEmail(user.email, user.name, resetUrl).catch((e) =>
      console.error('[forgot-password] send failed:', e)
    );
    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error('[forgot-password]', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
