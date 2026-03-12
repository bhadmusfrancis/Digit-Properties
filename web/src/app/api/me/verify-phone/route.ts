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
  sendPhoneOtpViaTermii,
  isTwilioVerifyConfigured,
  isTermiiConfigured,
  PHONE_OTP_COOLDOWN_MS,
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

    // Prevent multiple pins: enforce cooldown since last OTP send
    const lastSent = user.phoneOtpLastSentAt ? new Date(user.phoneOtpLastSentAt).getTime() : 0;
    const now = Date.now();
    if (lastSent && now - lastSent < PHONE_OTP_COOLDOWN_MS) {
      const waitMinutes = Math.ceil((PHONE_OTP_COOLDOWN_MS - (now - lastSent)) / 60000);
      return NextResponse.json(
        { error: `Please wait ${waitMinutes} minute(s) before requesting another code.` },
        { status: 429 }
      );
    }

    user.phone = normalized;

    // 1) Termii (primary for SMS): "Your Digit Properties Verification Pin is XXXXXX. It expires in 30 minutes."
    let twilioError: string | undefined;
    if (isTermiiConfigured()) {
      const termiiResult = await sendPhoneOtpViaTermii(normalized);
      if (termiiResult.ok && termiiResult.pinId) {
        user.phoneVerificationProvider = 'termii';
        user.phoneVerificationPinId = termiiResult.pinId;
        user.phoneVerificationExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
        user.phoneVerificationCode = undefined;
        user.phoneVerificationToken = undefined;
        user.phoneOtpLastSentAt = new Date();
        await user.save();
        return NextResponse.json({
          ok: true,
          message: 'Verification code sent to your phone via SMS. Enter the code below.',
          channel: 'sms',
        });
      }
      console.warn('[verify-phone] Termii send failed:', termiiResult.error);
    }

    // 2) Twilio Verify (SMS or WhatsApp)
    if (isTwilioVerifyConfigured()) {
      const twilioResult = await sendPhoneOtpViaTwilio(normalized);
      if (twilioResult.ok) {
        user.phoneVerificationProvider = 'twilio';
        user.phoneVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.phoneVerificationCode = undefined;
        user.phoneVerificationToken = undefined;
        user.phoneVerificationPinId = undefined;
        user.phoneOtpLastSentAt = new Date();
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
    }

    // 3) Fallback: app-generated code + Termii send (if Termii key set but send-token failed) or link
    const { code, token, expiresAt } = generatePhoneVerification();
    const hashedCode = await bcrypt.hash(code, 10);
    user.phoneVerificationCode = hashedCode;
    user.phoneVerificationExpires = expiresAt;
    user.phoneVerificationToken = token;
    user.phoneVerificationProvider = undefined;
    user.phoneVerificationPinId = undefined;
    await user.save();

    const sendResult = await sendPhoneOtp(normalized, code);
    if (sendResult.ok) {
      user.phoneOtpLastSentAt = new Date();
      await user.save();
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
