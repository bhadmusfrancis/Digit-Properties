import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { consumeRateLimit } from '@/lib/rate-limit';
import {
  normalizePhone,
  generatePhoneVerification,
  sendPhoneOtp,
  sendPhoneOtpViaTwilioWhatsApp,
  getPhoneVerificationLink,
  isTwilioVerifyConfigured,
} from '@/lib/phone-verify';
import { sendPhoneVerificationEmail } from '@/lib/email';
import { phoneVerifySchema } from '@/lib/validations';

const RATE_PREFIX = 'verify-phone';

/** POST /api/me/verify-phone — send OTP (or get link) for phone verification */
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
        { status: 429, headers: rate.retryAfter ? { 'Retry-After': String(rate.retryAfter) } : undefined }
      );
    }
    const body = await req.json().catch(() => ({}));
    const parsed = phoneVerifySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json({ error: first?.message ?? 'Invalid phone' }, { status: 400 });
    }
    const normalized = normalizePhone(parsed.data.phone);
    if (normalized.length < 12) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    user.phone = normalized;

    if (isTwilioVerifyConfigured()) {
      const twilioResult = await sendPhoneOtpViaTwilioWhatsApp(normalized);
      if (twilioResult.ok) {
        user.phoneVerificationProvider = 'twilio';
        user.phoneVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.phoneVerificationCode = undefined;
        user.phoneVerificationToken = undefined;
        await user.save();
        return NextResponse.json({
          ok: true,
          message: 'Verification code sent to your WhatsApp. Enter the code below.',
          channel: 'whatsapp',
        });
      }
    }

    const { code, token, expiresAt } = generatePhoneVerification();
    const hashedCode = await bcrypt.hash(code, 10);
    user.phoneVerificationCode = hashedCode;
    user.phoneVerificationExpires = expiresAt;
    user.phoneVerificationToken = token;
    user.phoneVerificationProvider = undefined;
    await user.save();

    const sendResult = await sendPhoneOtp(normalized, code);
    if (sendResult.ok) {
      return NextResponse.json({
        ok: true,
        message: 'Verification code sent to your phone.',
        channel: process.env.TERMII_CHANNEL || 'sms',
      });
    }
    const verifyLink = getPhoneVerificationLink(token);
    await sendPhoneVerificationEmail(user.email, user.name, verifyLink).catch((e) =>
      console.error('[verify-phone] email:', e)
    );
    return NextResponse.json({
      ok: true,
      message: 'Verification link sent to your email. Open it on your phone, or use the link below.',
      verifyLink,
    });
  } catch (e) {
    console.error('[verify-phone]', e);
    return NextResponse.json({ error: 'Failed to send verification' }, { status: 500 });
  }
}
