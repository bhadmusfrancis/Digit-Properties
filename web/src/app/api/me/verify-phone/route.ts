import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/get-session';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { consumeRateLimit } from '@/lib/rate-limit';
import {
  normalizePhone,
  isValidNigerianPhone,
  generatePhoneVerification,
  sendPhoneOtp,
  sendPhoneOtpViaTwilio,
  isTwilioVerifyConfigured,
} from '@/lib/phone-verify';
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
    if (!isValidNigerianPhone(normalized)) {
      return NextResponse.json(
        { error: 'Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)' },
        { status: 400 }
      );
    }
    await dbConnect();
    const otherWithPhone = await User.findOne({
      phone: normalized,
      phoneVerifiedAt: { $ne: null },
      _id: { $ne: session.user.id },
    }).select('_id').lean();
    if (otherWithPhone) {
      return NextResponse.json(
        { error: 'This phone number is already attached to a different account.' },
        { status: 400 }
      );
    }
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    user.phone = normalized;

    let twilioError: string | undefined;
    if (isTwilioVerifyConfigured()) {
      const twilioResult = await sendPhoneOtpViaTwilio(normalized);
      if (twilioResult.ok) {
        user.phoneVerificationProvider = 'twilio';
        user.phoneVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.phoneVerificationCode = undefined;
        user.phoneVerificationToken = undefined;
        await user.save();
        const channel = twilioResult.channel || 'sms';
        return NextResponse.json({
          ok: true,
          message:
            channel === 'whatsapp'
              ? 'Verification code sent to your WhatsApp. Enter the code below.'
              : 'Verification code sent to your phone via SMS. Enter the code below.',
          channel,
        });
      }
      twilioError = twilioResult.error;
      console.warn('[verify-phone] Twilio send failed:', twilioError);
    } else {
      console.warn('[verify-phone] Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID in .env.local and restart the server.');
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

    user.phoneVerificationCode = undefined;
    user.phoneVerificationToken = undefined;
    user.phoneVerificationExpires = undefined;
    await user.save();

    const errorMessage =
      twilioError || sendResult.error
        ? 'We couldn\'t send a verification code to this number. Check the number and try again.'
        : 'Phone verification is not configured. Please try again later or contact support.';
    return NextResponse.json(
      { error: errorMessage, ...(twilioError && { twilioError }) },
      { status: 503 }
    );
  } catch (e) {
    console.error('[verify-phone]', e);
    return NextResponse.json({ error: 'Failed to send verification' }, { status: 500 });
  }
}
